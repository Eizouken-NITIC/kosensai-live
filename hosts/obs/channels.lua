-- 本部 OBS の音声の振り分けと、会場ごとの配信休止。OBS の「ツール → スクリプト」でこのファイルを追加する。
-- ソースとシーンの名前は scenes.json(このファイルと同じフォルダ)の audio・signal_lost・cm_corner・hotkeys から読む。
--
-- 1. audio.always のシーンを出力チャンネルに接続し、どのシーンをプログラムに出していても
--    Ch1・Ch2 の音声がミキサーに入るようにする。obs-multi-rtmp がプログラム以外のシーンを
--    送出しても、そのシーンにしか無いソースの音声はミキサーに入らないため。
--    シーンの中の映像は画面外に配置してあるため、プログラムには何も映らない。
-- 2. Ch3(トラック 1)には、プログラムのシーン(入れ子を含む)に表示されている映像のうち、
--    audio.ch3 の順で最初に見つかった会場の音声だけを入れる。本部のモニターにも同じ音声を出し、
--    本部では Ch3 の視聴者と同じ音を聞く。
-- 3. audio.pause の会場ごとに、ホットキーの「<会場> 休止: 出す」で、show のソースを全シーンで表示し、
--    hide のソースを全シーンで隠し、audio をミュートする。「<会場> 休止: 消す」で戻す。配信しない演目は
--    時刻が押しや巻きでずれるため、時刻では切り替えず、本部が演目の始まりと終わりを見て切り替える。
--    休止の状態はスクリプトの設定に保存し、OBS を再起動しても残す。
--    ミュートは音声のトラックの割り当てを変えないので、休止中に OBS を再起動しても割り当ては残る。
-- 4. signal_lost の映像(遊撃のスマートフォン)の SRT が切れて映像が消えている間は、hide のソース
--    (遊撃のテロップ)を全シーンで隠す。映像の下に配置した休止の画面が表示されるため、その上に演目を出さない。
--    休止と signal_lost の両方が隠すソースは、どちらか一方でも隠す理由があれば隠す。
--    SRT は数秒の途切れでは切断と判断しないため、短い途切れでは切り替わらない。
-- 5. cm_corner の scene に、毎時 every_min 分ごとに CM のスライドショーを show_sec 秒だけ表示する。
--    普段は右下の小窓(source)を出し、lost_video(遊撃)の映像が消えて休止の画面が出ている間は、
--    全画面(full_source)を出す。lost_video を休止で隠している間も全画面にする。
--    スライドショーは隠すと止まり、次に表示すると続きのスライドから進む。ホットキーの
--    「CM 小窓: 自動で出す」「CM 小窓: 出さない」で切り替え、状態はスクリプトの設定に保存する。
-- 6. ホットキーの「<会場> SRT を受け直す」で、restart の Ch の中継(kosensai-live relay)の ffmpeg を
--    起動し直す。.relay/restart-<Ch> のファイルを作ると、relay がその Ch の ffmpeg を終了させて起動し直す。
--    送信元との接続が残ったまま映像が届かない時に使う。Ch3 のシーンは変えない。
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
local pauses = {} -- { { id = ..., name = ..., show = { ... }, hide = { ... }, audio = ..., on = false }, ... }
local signal_lost = {} -- { { video = ..., hide = { ... }, lost = nil }, ... }
local restarts = {} -- { { id = ..., name = ... }, ... }
local cm_corner = nil -- { scene = ..., source = ..., full_source = ..., lost_video = ..., every_min = ..., show_sec = ... }
-- scenes.json の hotkeys。ホットキーの ID → キー(OBS_KEY_ を除いた名前)。
local hotkey_keys = {}
-- 最後に設定した各ソースの表示。変わった時だけ全シーンに反映する。
local applied_visible = {}
-- 右下の CM。cm_auto は自動で出すかどうか、cm_shown_at は表示を始めた時刻(表示していなければ nil)、
-- cm_slot は最後に表示した回(毎時 every_min 分ごとの区切りの番号)。
local cm_auto = true
local cm_shown_at = nil
local cm_shown_source = nil
local cm_slot = nil

local function script_dir()
  return script_path():gsub("[/\\]$", "")
end

local function load_json(name)
  local path = script_dir() .. "/" .. name
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
  -- 読み直しても休止の状態は残す。
  local was = {}
  for _, p in ipairs(pauses) do
    was[p.id] = p.on
  end
  pauses = {}
  each(audio, "pause", function(item)
    local p = {
      id = obslua.obs_data_get_string(item, "id"),
      name = obslua.obs_data_get_string(item, "name"),
      show = {},
      hide = {},
      audio = obslua.obs_data_get_string(item, "audio"),
    }
    p.on = was[p.id] or false
    each(item, "show", function(x)
      table.insert(p.show, obslua.obs_data_get_string(x, "source"))
    end)
    each(item, "hide", function(x)
      table.insert(p.hide, obslua.obs_data_get_string(x, "source"))
    end)
    table.insert(pauses, p)
  end)
  obslua.obs_data_release(audio)
  restarts = {}
  each(scenes, "restart", function(item)
    table.insert(restarts, {
      id = obslua.obs_data_get_string(item, "id"),
      name = obslua.obs_data_get_string(item, "name"),
    })
  end)
  hotkey_keys = {}
  local keys = obslua.obs_data_get_obj(scenes, "hotkeys")
  if keys ~= nil then
    local ids = { "cm.on", "cm.off" }
    for _, r in ipairs(restarts) do
      table.insert(ids, "restart." .. r.id)
    end
    for _, p in ipairs(pauses) do
      table.insert(ids, "pause." .. p.id .. ".on")
      table.insert(ids, "pause." .. p.id .. ".off")
    end
    for _, id in ipairs(ids) do
      hotkey_keys[id] = obslua.obs_data_get_string(keys, id)
    end
    obslua.obs_data_release(keys)
  end
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
      scene = obslua.obs_data_get_string(cm, "scene"),
      source = obslua.obs_data_get_string(cm, "source"),
      full_source = obslua.obs_data_get_string(cm, "full_source"),
      lost_video = obslua.obs_data_get_string(cm, "lost_video"),
      every_min = obslua.obs_data_get_int(cm, "every_min"),
      show_sec = obslua.obs_data_get_int(cm, "show_sec"),
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

local function paused_audio(name)
  for _, p in ipairs(pauses) do
    if p.on and p.audio == name then
      return true
    end
  end
  return false
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
    if chosen == nil and found[pair.video] and not paused_audio(pair.audio) then
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

-- 休止と signal_lost が扱うソースの表示を決め、変わったものだけ全シーンに反映する。show のソースは
-- 休止中の会場が 1 つでもあれば表示し、hide のソースは隠す理由が 1 つでもあれば隠す。
-- force のときは変わっていなくても反映する(シーンを作り直した後など)。
local function apply_visibility(force)
  local visible = {}
  for _, p in ipairs(pauses) do
    for _, name in ipairs(p.show) do
      visible[name] = visible[name] or p.on
    end
    for _, name in ipairs(p.hide) do
      if visible[name] == nil then
        visible[name] = true
      end
      visible[name] = visible[name] and not p.on
    end
  end
  for _, entry in ipairs(signal_lost) do
    for _, name in ipairs(entry.hide) do
      if visible[name] == nil then
        visible[name] = true
      end
      visible[name] = visible[name] and not entry.lost
    end
  end
  for name, v in pairs(visible) do
    if force or applied_visible[name] ~= v then
      applied_visible[name] = v
      set_visible_everywhere(name, v)
    end
  end
end

local function update_signal_lost()
  local changed = false
  for _, entry in ipairs(signal_lost) do
    local lost = video_lost(entry.video)
    if lost ~= entry.lost then
      entry.lost = lost
      changed = true
      obslua.script_log(obslua.LOG_INFO, entry.video .. (lost and " の映像が消えた" or " の映像が戻った"))
    end
  end
  if changed then
    apply_visibility(false)
  end
end

-- 全シーンの休止の画面の表示と、休止する会場の音声のミュートを、各会場の休止の状態に合わせる。
local function apply_pause(force)
  apply_visibility(force)
  for _, p in ipairs(pauses) do
    local audio = p.audio ~= "" and obslua.obs_get_source_by_name(p.audio)
    if audio then
      obslua.obs_source_set_muted(audio, p.on)
      obslua.obs_source_release(audio)
    end
  end
  update_track1()
end

-- 休止で隠している映像か。
local function paused_video(name)
  for _, p in ipairs(pauses) do
    for _, h in ipairs(p.hide) do
      if p.on and h == name then
        return true
      end
    end
  end
  return false
end

-- scene_name のシーンの name のソースの表示を切り替える。全画面の CM は Ch3 CM のシーンにもあるため、
-- 全シーンではなく cm_corner.scene だけを切り替える。
local function set_visible_in(scene_name, name, visible)
  local scene_source = obslua.obs_get_source_by_name(scene_name)
  if scene_source == nil then
    return
  end
  local item = obslua.obs_scene_find_source(obslua.obs_scene_from_source(scene_source), name)
  if item ~= nil then
    obslua.obs_sceneitem_set_visible(item, visible)
  end
  obslua.obs_source_release(scene_source)
end

local function hide_cm()
  cm_shown_at = nil
  cm_shown_source = nil
  set_visible_in(cm_corner.scene, cm_corner.source, false)
  set_visible_in(cm_corner.scene, cm_corner.full_source, false)
end

local function update_cm()
  if cm_corner == nil then
    return
  end
  if cm_shown_at ~= nil then
    if os.time() - cm_shown_at >= cm_corner.show_sec then
      hide_cm()
    end
  elseif cm_auto then
    local slot = math.floor(os.time() / (cm_corner.every_min * 60))
    if slot ~= cm_slot then
      cm_slot = slot
      -- 遊撃の映像が消えるか休止で隠れて、休止の画面が出ている間は、全画面で出す。
      local off = video_lost(cm_corner.lost_video) or paused_video(cm_corner.lost_video)
      cm_shown_source = off and cm_corner.full_source or cm_corner.source
      -- スライドの画像が無ければ(幅が 0)出さない。
      if not video_lost(cm_shown_source) then
        cm_shown_at = os.time()
        set_visible_in(cm_corner.scene, cm_shown_source, true)
      end
    end
  end
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

local function set_paused(id, on)
  return function(pressed)
    if not pressed then
      return
    end
    for _, p in ipairs(pauses) do
      if p.id == id and p.on ~= on then
        p.on = on
        obslua.script_log(obslua.LOG_INFO, p.name .. (on and " の配信休止を表示した" or " の配信休止を解除した"))
        apply_pause(false)
      end
    end
  end
end

local function restart_relay(r)
  return function(pressed)
    if not pressed then
      return
    end
    local path = script_dir() .. "/.relay/restart-" .. r.id
    local f, err = io.open(path, "w")
    if f == nil then
      obslua.script_log(obslua.LOG_WARNING, path .. " を作成できない(kosensai-live relay が動いていない?): " .. err)
      return
    end
    f:close()
    obslua.script_log(obslua.LOG_INFO, r.name .. " の SRT の受け直しを要求した")
  end
end

local function on_event(event)
  if event == obslua.OBS_FRONTEND_EVENT_FINISHED_LOADING or event == obslua.OBS_FRONTEND_EVENT_SCENE_COLLECTION_CHANGED then
    attach_always_scene(true)
    apply_pause(true)
    -- 前回の終了時に表示していた CM が残らないよう隠す(script_load の時点ではシーンがまだ無い)。
    if cm_corner ~= nil then
      hide_cm()
    end
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
    .. "ホットキーで会場ごとに休止の画面を表示し、その会場の音声をミュートする。"
    .. "遊撃の映像が消えている間は、遊撃のテロップを隠す。"
end

function script_properties()
  local props = obslua.obs_properties_create()
  obslua.obs_properties_add_button(props, "reload", "scenes.json を読み直す", function()
    load_config()
    attach_always_scene(true)
    apply_pause(true)
    return false
  end)
  return props
end

function script_defaults(settings)
  obslua.obs_data_set_default_bool(settings, "cm_auto", true)
end

-- ホットキーに scenes.json の hotkeys のキーを割り当てる。OBS の設定画面で変えたキーは、読み込みのたびに
-- scenes.json の値に戻る。
local function register_hotkey(id, label, callback)
  local hotkey = obslua.obs_hotkey_register_frontend("kosensai." .. id, label, callback)
  local binding = obslua.obs_data_array_create()
  if hotkey_keys[id] ~= nil and hotkey_keys[id] ~= "" then
    local key = obslua.obs_data_create()
    obslua.obs_data_set_string(key, "key", "OBS_KEY_" .. hotkey_keys[id])
    obslua.obs_data_array_push_back(binding, key)
    obslua.obs_data_release(key)
  end
  obslua.obs_hotkey_load(hotkey, binding)
  obslua.obs_data_array_release(binding)
end

function script_load(settings)
  cm_auto = obslua.obs_data_get_bool(settings, "cm_auto")
  load_config()
  for _, p in ipairs(pauses) do
    p.on = obslua.obs_data_get_bool(settings, "paused_" .. p.id)
    register_hotkey("pause." .. p.id .. ".on", p.name .. " 休止: 出す", set_paused(p.id, true))
    register_hotkey("pause." .. p.id .. ".off", p.name .. " 休止: 消す", set_paused(p.id, false))
  end
  for _, r in ipairs(restarts) do
    register_hotkey("restart." .. r.id, r.name .. " SRT を受け直す", restart_relay(r))
  end
  register_hotkey("cm.on", "CM 小窓: 自動で出す", set_cm_auto(true))
  register_hotkey("cm.off", "CM 小窓: 出さない", set_cm_auto(false))
  obslua.obs_frontend_add_event_callback(on_event)
  attach_always_scene(false)
  apply_pause(true)
  -- 起動した回は出さず、次の区切りから出す。
  cm_slot = cm_corner and math.floor(os.time() / (cm_corner.every_min * 60))
  obslua.timer_add(tick, 1000)
end

function script_save(settings)
  for _, p in ipairs(pauses) do
    obslua.obs_data_set_bool(settings, "paused_" .. p.id, p.on)
  end
  obslua.obs_data_set_bool(settings, "cm_auto", cm_auto)
end

function script_unload()
  obslua.timer_remove(tick)
  obslua.obs_set_output_source(CHANNEL, nil)
end
