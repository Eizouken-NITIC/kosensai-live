-- 本部 OBS の音声の振り分けと、第一体育館の配信休止。OBS の「ツール → スクリプト」でこのファイルを追加する。
-- ソースとシーンの名前は assets/scenes.json の audio・signal_lost・cm_corner から読む。
--
-- 1. audio.always のシーンを出力チャンネルに接続し、どのシーンをプログラムに出していても
--    Ch1・Ch2 の音声がミキサーに入るようにする。obs-multi-rtmp がプログラム以外のシーンを
--    送出しても、そのシーンにしか無いソースの音声はミキサーに入らないため。
--    シーンの中の映像は画面外に配置してあるため、プログラムには何も映らない。
-- 2. Ch3(トラック 1)には、プログラムのシーン(入れ子を含む)に表示されている映像のうち、
--    audio.ch3 の順で最初に見つかった会場の音声だけを入れる。本部のモニターにも同じ音声を出し、
--    本部では Ch3 の視聴者と同じ音を聞く。
-- 3. ホットキーの「配信休止: 出す」で、audio.pause.source を全シーンで表示し、audio.pause.audio を
--    ミュートする。「配信休止: 消す」で戻す。配信しない演目は時刻が押しや巻きでずれるため、
--    時刻では切り替えず、本部が演目の始まりと終わりを見て切り替える。
--    休止の状態はスクリプトの設定に保存し、OBS を再起動しても残す。
--    ミュートは音声のトラックの割り当てを変えないので、休止中に OBS を再起動しても割り当ては残る。
-- 4. signal_lost の映像(遊撃のスマートフォン)の SRT が切れて映像が消えている間は、hide のソース
--    (遊撃のテロップ)を全シーンで隠す。映像の下に配置した休止の画面が表示されるため、その上に演目を出さない。
--    SRT は数秒の途切れでは切断と判断しないため、短い途切れでは切り替わらない。
-- 5. cm_corner の小窓(右下の CM)を、毎時 every_min 分ごとに全シーンで表示し、再生が終わったら隠す。
--    動画のファイルは file_from の入力(全画面の CM)と同じものに合わせる。ホットキーの
--    「CM 小窓: 自動で出す」「CM 小窓: 出さない」で切り替え、状態はスクリプトの設定に保存する。
--
-- 休止の画面を表示するかどうかはこのスクリプトだけで制御する。overlays/pause.html は再開の時刻を表示するだけである。

obs = obslua

-- 0 はトランジション、1〜6 はグローバル音声デバイスが使用する。
local CHANNEL = 20
-- トラック 1 のビット。OBS の Lua は LuaJIT(Lua 5.1)で、ビット演算子が無いため bit ライブラリを使用する。
local TRACK1 = 1

-- scenes.json の audio。
local always_scene = nil
local ch3 = {} -- { { video = ..., audio = ... }, ... }
local pause = {} -- { source = ..., audio = ... }
local signal_lost = {} -- { { video = ..., hide = { ... }, lost = nil }, ... }
local cm_corner = nil -- { source = ..., file_from = ..., every_min = ... }
local paused = false
-- 右下の CM。cm_auto は自動で出すかどうか、cm_shown_at は表示を始めた時刻(表示していなければ nil)、
-- cm_slot は最後に表示した回(毎時 every_min 分ごとの区切りの番号)。
local cm_auto = true
local cm_shown_at = nil
local cm_slot = nil
-- 再生の終わりを検出できない場合に、小窓を隠すまでの秒数
local CM_MAX_SEC = 180
local hotkeys = {}

local function script_dir()
  return script_path():gsub("[/\\]$", "")
end

local function load_json(name)
  local path = script_dir() .. "/assets/" .. name
  local data = obslua.obs_data_create_from_json_file(path)
  if data == nil then
    obslua.script_log(obslua.LOG_WARNING, path .. " を読み込めない")
  end
  return data
end

-- obs_data の配列の各要素(オブジェクト)に fn を適用する。
local function each(data, key, fn)
  local arr = obslua.obs_data_get_array(data, key)
  for i = 0, obslua.obs_data_array_count(arr) - 1 do
    local item = obslua.obs_data_array_item(arr, i)
    fn(item)
    obslua.obs_data_release(item)
  end
  obslua.obs_data_array_release(arr)
end

local function load_config()
  local scenes = load_json("scenes.json")
  if scenes == nil then
    return
  end
  local audio = obslua.obs_data_get_obj(scenes, "audio")
  always_scene = obslua.obs_data_get_string(audio, "always")
  ch3 = {}
  each(audio, "ch3", function(item)
    table.insert(ch3, { video = obslua.obs_data_get_string(item, "video"), audio = obslua.obs_data_get_string(item, "audio") })
  end)
  local p = obslua.obs_data_get_obj(audio, "pause")
  pause = {
    source = obslua.obs_data_get_string(p, "source"),
    audio = obslua.obs_data_get_string(p, "audio"),
  }
  obslua.obs_data_release(p)
  obslua.obs_data_release(audio)
  signal_lost = {}
  each(scenes, "signal_lost", function(item)
    local entry = { video = obslua.obs_data_get_string(item, "video"), hide = {}, lost = nil }
    each(item, "hide", function(h)
      table.insert(entry.hide, obslua.obs_data_get_string(h, "source"))
    end)
    table.insert(signal_lost, entry)
  end)
  cm_corner = nil
  local cm = obslua.obs_data_get_obj(scenes, "cm_corner")
  if cm ~= nil then
    cm_corner = {
      source = obslua.obs_data_get_string(cm, "source"),
      file_from = obslua.obs_data_get_string(cm, "file_from"),
      every_min = obslua.obs_data_get_int(cm, "every_min"),
    }
    obslua.obs_data_release(cm)
  end
  obslua.obs_data_release(scenes)
end

local function attach_always_scene(warn)
  local source = always_scene and obslua.obs_get_source_by_name(always_scene)
  obslua.obs_set_output_source(CHANNEL, source)
  if source ~= nil then
    obslua.obs_source_release(source)
  elseif warn then
    obslua.script_log(obslua.LOG_WARNING, tostring(always_scene) .. " シーンがない")
  end
end

local function collect(scene_source, found)
  local scene = obslua.obs_scene_from_source(scene_source) or obslua.obs_group_from_source(scene_source)
  if scene == nil then
    return
  end
  local items = obslua.obs_scene_enum_items(scene)
  for _, item in ipairs(items) do
    if obslua.obs_sceneitem_visible(item) then
      local source = obslua.obs_sceneitem_get_source(item)
      found[obslua.obs_source_get_name(source)] = true
      local id = obslua.obs_source_get_id(source)
      if id == "scene" or id == "group" then
        collect(source, found)
      end
    end
  end
  obslua.sceneitem_list_release(items)
end

-- トラック 1 への出力と、本部のモニターを切り替える。モニターは「モニターと出力」にする
-- (「モニターのみ」はトラックへの出力を止めるため、Ch1・Ch2 の配信から音声が消える)。
local function set_track1(name, on)
  local source = obslua.obs_get_source_by_name(name)
  if source == nil then
    return
  end
  local mixers = obslua.obs_source_get_audio_mixers(source)
  if on then
    mixers = bit.bor(mixers, TRACK1)
  else
    mixers = bit.band(mixers, bit.bnot(TRACK1))
  end
  obslua.obs_source_set_audio_mixers(source, mixers)
  obslua.obs_source_set_monitoring_type(source,
    on and obslua.OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT or obslua.OBS_MONITORING_TYPE_NONE)
  obslua.obs_source_release(source)
end

-- Ch3(トラック 1)の音声と本部のモニター。休止中は休止する会場の音声を候補から外し、2 画面ではもう一方の会場の音声にする。
local function update_track1()
  local scene = obslua.obs_frontend_get_current_scene()
  if scene == nil then
    return
  end
  local found = {}
  collect(scene, found)
  obslua.obs_source_release(scene)

  local chosen = nil
  for _, pair in ipairs(ch3) do
    if chosen == nil and found[pair.video] and not (paused and pair.audio == pause.audio) then
      chosen = pair.audio
    end
  end
  for _, pair in ipairs(ch3) do
    set_track1(pair.audio, pair.audio == chosen)
  end
end

-- 全シーンの name のソースの表示を切り替える。
local function set_visible_everywhere(name, visible)
  local scenes = obslua.obs_frontend_get_scenes()
  for _, scene_source in ipairs(scenes) do
    local scene = obslua.obs_scene_from_source(scene_source)
    local items = obslua.obs_scene_enum_items(scene)
    for _, item in ipairs(items) do
      if obslua.obs_source_get_name(obslua.obs_sceneitem_get_source(item)) == name then
        obslua.obs_sceneitem_set_visible(item, visible)
      end
    end
    obslua.sceneitem_list_release(items)
  end
  obslua.source_list_release(scenes)
end

-- 映像の幅が 0 なら、SRT が切れて映像が消えている。
local function video_lost(name)
  local source = obslua.obs_get_source_by_name(name)
  if source == nil then
    return false
  end
  local lost = obslua.obs_source_get_width(source) == 0
  obslua.obs_source_release(source)
  return lost
end

local function update_signal_lost()
  for _, entry in ipairs(signal_lost) do
    local lost = video_lost(entry.video)
    if lost ~= entry.lost then
      entry.lost = lost
      for _, name in ipairs(entry.hide) do
        set_visible_everywhere(name, not lost)
      end
      obslua.script_log(obslua.LOG_INFO, entry.video .. (lost and " の映像が消えた" or " の映像が戻った"))
    end
  end
end

-- 全シーンの休止の画面の表示と、休止する会場の音声のミュートを paused に合わせる。
local function apply_pause()
  set_visible_everywhere(pause.source, paused)
  local audio = pause.audio and obslua.obs_get_source_by_name(pause.audio)
  if audio ~= nil then
    obslua.obs_source_set_muted(audio, paused)
    obslua.obs_source_release(audio)
  end
  update_track1()
end

-- 小窓の動画のファイルを、全画面の CM のファイルに合わせる。ファイルが無ければ空の文字列を返す。
local function sync_cm_file()
  local from = obslua.obs_get_source_by_name(cm_corner.file_from)
  local to = obslua.obs_get_source_by_name(cm_corner.source)
  local file = ""
  if from ~= nil and to ~= nil then
    local fs = obslua.obs_source_get_settings(from)
    local ts = obslua.obs_source_get_settings(to)
    file = obslua.obs_data_get_string(fs, "local_file")
    if obslua.obs_data_get_string(ts, "local_file") ~= file then
      obslua.obs_data_set_string(ts, "local_file", file)
      obslua.obs_source_update(to, ts)
    end
    obslua.obs_data_release(fs)
    obslua.obs_data_release(ts)
  end
  if from ~= nil then obslua.obs_source_release(from) end
  if to ~= nil then obslua.obs_source_release(to) end
  return file
end

local function hide_cm()
  cm_shown_at = nil
  set_visible_everywhere(cm_corner.source, false)
end

local function update_cm()
  if cm_corner == nil then
    return
  end
  local file = sync_cm_file()
  local source = obslua.obs_get_source_by_name(cm_corner.source)
  if source == nil then
    return
  end
  if cm_shown_at ~= nil then
    local ended = obslua.obs_source_media_get_state(source) == obslua.OBS_MEDIA_STATE_ENDED
    -- 再生を始めた直後は前回の終了の状態が残っているため、2 秒は終了と見なさない。
    if (ended and os.time() - cm_shown_at >= 2) or os.time() - cm_shown_at > CM_MAX_SEC then
      hide_cm()
    end
  elseif cm_auto and file ~= "" then
    local slot = math.floor(os.time() / (cm_corner.every_min * 60))
    if slot ~= cm_slot then
      cm_slot = slot
      cm_shown_at = os.time()
      set_visible_everywhere(cm_corner.source, true)
      obslua.obs_source_media_restart(source)
    end
  end
  obslua.obs_source_release(source)
end

local function set_cm_auto(on)
  return function(pressed)
    if pressed and on ~= cm_auto then
      cm_auto = on
      obslua.script_log(obslua.LOG_INFO, cm_auto and "CM 小窓を自動で出す" or "CM 小窓を出さない")
      if not cm_auto and cm_corner ~= nil then
        hide_cm()
      end
    end
  end
end

local function tick()
  update_signal_lost()
  update_cm()
end

local function set_paused(on)
  return function(pressed)
    if pressed and on ~= paused then
      paused = on
      obslua.script_log(obslua.LOG_INFO, paused and "配信休止を表示した" or "配信休止を解除した")
      apply_pause()
    end
  end
end

local function on_event(event)
  if event == obslua.OBS_FRONTEND_EVENT_FINISHED_LOADING or event == obslua.OBS_FRONTEND_EVENT_SCENE_COLLECTION_CHANGED then
    attach_always_scene(true)
    apply_pause()
  elseif event == obslua.OBS_FRONTEND_EVENT_SCENE_LIST_CHANGED then
    -- kosensai-live obs build で後からシーンを作った場合に接続する。
    attach_always_scene(false)
  elseif event == obslua.OBS_FRONTEND_EVENT_SCENE_CHANGED then
    update_track1()
  elseif event == obslua.OBS_FRONTEND_EVENT_SCENE_COLLECTION_CHANGING then
    obslua.obs_set_output_source(CHANNEL, nil)
  end
end

function script_description()
  return "Ch1・Ch2 の音声をミキサーに常時入れ、Ch3 の音声と本部のモニターを表示中の会場に合わせる。"
    .. "ホットキーで第一体育館の休止の画面を表示し、その会場の音声をミュートする。"
    .. "遊撃の映像が消えている間は、遊撃のテロップを隠す。"
end

function script_properties()
  local props = obslua.obs_properties_create()
  obslua.obs_properties_add_button(props, "reload", "assets を読み直す", function()
    load_config()
    attach_always_scene(true)
    apply_pause()
    return false
  end)
  return props
end

function script_defaults(settings)
  obslua.obs_data_set_default_bool(settings, "cm_auto", true)
end

function script_load(settings)
  paused = obslua.obs_data_get_bool(settings, "paused")
  cm_auto = obslua.obs_data_get_bool(settings, "cm_auto")
  load_config()
  local defs = {
    { "kosensai.pause.on", "配信休止: 出す", set_paused(true) },
    { "kosensai.pause.off", "配信休止: 消す", set_paused(false) },
    { "kosensai.cm.on", "CM 小窓: 自動で出す", set_cm_auto(true) },
    { "kosensai.cm.off", "CM 小窓: 出さない", set_cm_auto(false) },
  }
  for _, d in ipairs(defs) do
    local id = obslua.obs_hotkey_register_frontend(d[1], d[2], d[3])
    local saved = obslua.obs_data_get_array(settings, d[1])
    obslua.obs_hotkey_load(id, saved)
    obslua.obs_data_array_release(saved)
    hotkeys[d[1]] = id
  end
  obslua.obs_frontend_add_event_callback(on_event)
  attach_always_scene(false)
  apply_pause()
  if cm_corner ~= nil then
    hide_cm()
  end
  -- 起動した回は出さず、次の区切りから出す。
  cm_slot = cm_corner and math.floor(os.time() / (cm_corner.every_min * 60))
  obslua.timer_add(tick, 1000)
end

function script_save(settings)
  obslua.obs_data_set_bool(settings, "paused", paused)
  obslua.obs_data_set_bool(settings, "cm_auto", cm_auto)
  for name, id in pairs(hotkeys) do
    local arr = obslua.obs_hotkey_save(id)
    obslua.obs_data_set_array(settings, name, arr)
    obslua.obs_data_array_release(arr)
  end
end

function script_unload()
  obslua.timer_remove(tick)
  obslua.obs_set_output_source(CHANNEL, nil)
end
