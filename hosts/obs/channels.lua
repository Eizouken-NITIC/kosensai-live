-- 本部 OBS の音声の振り分けと、第一体育館の配信休止。OBS の「ツール → スクリプト」でこのファイルを追加する。
-- ソースとシーンの名前は assets/scenes.json の audio、配信しない時間は assets/program.json から読む。
--
-- 1. audio.always のシーンを出力チャンネルにつなぎ、どのシーンをプログラムに出していても
--    Ch1・Ch2 の音声がミキサーに入るようにする。obs-multi-rtmp がプログラム以外のシーンを
--    送出しても、そのシーンにしか無いソースの音声はミキサーに入らないため。
--    シーンの中の映像は画面の外に置いてあるので、プログラムには何も映らない。
-- 2. Ch3(トラック 1)には、プログラムのシーン(入れ子を含む)に表示されている映像のうち、
--    audio.ch3 の順で最初に見つかった会場の音声だけを入れる。
-- 3. audio.pause.channel の配信をしない時間(program.json の種類が ng の項目)は、
--    audio.pause.source を全シーンで表示し、audio.pause.audio をミュートする。
--    ミュートは音声のトラックの割り当てを変えないので、休止中に OBS を再起動しても割り当ては残る。
--    押しや巻きに備え、ホットキーで「休止を出す」「休止を出さない」「予定どおり」を切り替えられる。
--
-- 休止の判定はこのスクリプトだけが行う。overlays/pause.html は再開の時刻を出すだけで、
-- 表示するかどうかは決めない。

obs = obslua

-- 0 はトランジション、1〜6 はグローバル音声デバイスが使用する。
local CHANNEL = 20
-- トラック 1 のビット。OBS の Lua は LuaJIT(Lua 5.1)で、ビット演算子が無いため bit ライブラリを使用する。
local TRACK1 = 1

-- scenes.json の audio。
local always_scene = nil
local ch3 = {} -- { { video = ..., audio = ... }, ... }
local pause = {} -- { source = ..., audio = ..., channel = ... }
-- program.json の pause.channel の、日付 → 配信しない時間 { { "13:50", "14:15" }, ... }
local program = nil
local ng_cache = {}

-- 休止の切り替え。auto は program.json の時刻に従う。on と off はホットキーで固定した状態。
local mode = "auto"
-- 確認用の時刻("2026-10-24 13:55" の形)。空なら現在の時刻を使用する。
local test_now = ""
local paused = false
local hotkeys = {}

local function script_dir()
  return script_path():gsub("[/\\]$", "")
end

local function load_json(name)
  local path = script_dir() .. "/assets/" .. name
  local data = obslua.obs_data_create_from_json_file(path)
  if data == nil then
    obslua.script_log(obslua.LOG_WARNING, path .. " を読めません")
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
    channel = obslua.obs_data_get_string(p, "channel"),
  }
  obslua.obs_data_release(p)
  obslua.obs_data_release(audio)
  obslua.obs_data_release(scenes)

  if program ~= nil then
    obslua.obs_data_release(program)
  end
  program = load_json("program.json")
  ng_cache = {}
end

-- その日の配信しない時間。種類が ng の項目の開始〜次の項目の開始(最後なら end)。
local function ng_ranges(key)
  if ng_cache[key] == nil then
    local ranges = {}
    if program ~= nil then
      local ch = obslua.obs_data_get_obj(program, pause.channel)
      local days = obslua.obs_data_get_obj(ch, "days")
      local day = obslua.obs_data_get_obj(days, key)
      if day ~= nil then
        local items = {}
        each(day, "items", function(item)
          table.insert(items, { obslua.obs_data_get_string(item, "at"), obslua.obs_data_get_string(item, "kind") })
        end)
        local stop_of_day = obslua.obs_data_get_string(day, "end")
        for i, it in ipairs(items) do
          if it[2] == "ng" then
            table.insert(ranges, { it[1], items[i + 1] and items[i + 1][1] or stop_of_day })
          end
        end
        obslua.obs_data_release(day)
      end
      obslua.obs_data_release(days)
      obslua.obs_data_release(ch)
    end
    ng_cache[key] = ranges
    obslua.script_log(obslua.LOG_INFO, key .. " の配信しない時間を " .. #ranges .. " 件読みました")
  end
  return ng_cache[key]
end

local function now_key_hm()
  if test_now ~= "" then
    local key, hm = test_now:match("^(%d%d%d%d%-%d%d%-%d%d)%s+(%d%d:%d%d)$")
    if key then
      return key, hm
    end
  end
  return os.date("%Y-%m-%d"), os.date("%H:%M")
end

-- "HH:MM" の文字列は、桁が揃っているので文字列の比較で前後を判定できる。
local function in_ng()
  local key, hm = now_key_hm()
  for _, r in ipairs(ng_ranges(key)) do
    if r[1] <= hm and hm < r[2] then
      return true
    end
  end
  return false
end

local function attach_always_scene(warn)
  local source = always_scene and obslua.obs_get_source_by_name(always_scene)
  obslua.obs_set_output_source(CHANNEL, source)
  if source ~= nil then
    obslua.obs_source_release(source)
  elseif warn then
    obslua.script_log(obslua.LOG_WARNING, tostring(always_scene) .. " シーンがありません")
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
  obslua.obs_source_release(source)
end

-- Ch3(トラック 1)の音声。休止中は休止する会場の音声を候補から外し、2 画面ではもう一方の会場の音声にする。
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

-- 全シーンの休止の画面の表示と、休止する会場の音声のミュートを、paused に合わせる。
local function apply_pause()
  local scenes = obslua.obs_frontend_get_scenes()
  for _, scene_source in ipairs(scenes) do
    local scene = obslua.obs_scene_from_source(scene_source)
    local items = obslua.obs_scene_enum_items(scene)
    for _, item in ipairs(items) do
      if obslua.obs_source_get_name(obslua.obs_sceneitem_get_source(item)) == pause.source then
        obslua.obs_sceneitem_set_visible(item, paused)
      end
    end
    obslua.sceneitem_list_release(items)
  end
  obslua.source_list_release(scenes)
  local audio = pause.audio and obslua.obs_get_source_by_name(pause.audio)
  if audio ~= nil then
    obslua.obs_source_set_muted(audio, paused)
    obslua.obs_source_release(audio)
  end
  update_track1()
end

local function tick()
  local want = mode == "on" or (mode == "auto" and in_ng())
  if want ~= paused then
    paused = want
    obslua.script_log(obslua.LOG_INFO, paused and "配信休止を表示しました" or "配信休止を解除しました")
    apply_pause()
  end
end

local function set_mode(m)
  return function(pressed)
    if pressed then
      mode = m
      obslua.script_log(obslua.LOG_INFO, "配信休止の切り替え: " .. m)
      tick()
    end
  end
end

local function on_event(event)
  if event == obslua.OBS_FRONTEND_EVENT_FINISHED_LOADING or event == obslua.OBS_FRONTEND_EVENT_SCENE_COLLECTION_CHANGED then
    attach_always_scene(true)
    apply_pause()
  elseif event == obslua.OBS_FRONTEND_EVENT_SCENE_LIST_CHANGED then
    -- build-scenes.py で後からシーンを作った場合につなぐ。
    attach_always_scene(false)
  elseif event == obslua.OBS_FRONTEND_EVENT_SCENE_CHANGED then
    update_track1()
  elseif event == obslua.OBS_FRONTEND_EVENT_SCENE_COLLECTION_CHANGING then
    obslua.obs_set_output_source(CHANNEL, nil)
  end
end

function script_description()
  return "Ch1・Ch2 の音声をミキサーに常時入れ、Ch3 の音声を表示中の会場に合わせる。"
    .. "第一体育館の配信をしない時間は休止の画面を表示し、その会場の音声をミュートする。"
end

function script_properties()
  local props = obslua.obs_properties_create()
  obslua.obs_properties_add_text(props, "test_now", "確認用の時刻(例 2026-10-24 13:55、空なら現在)", obslua.OBS_TEXT_DEFAULT)
  obslua.obs_properties_add_button(props, "reload", "assets を読み直す", function()
    load_config()
    attach_always_scene(true)
    apply_pause()
    return false
  end)
  return props
end

function script_update(settings)
  test_now = obslua.obs_data_get_string(settings, "test_now")
  tick()
end

function script_load(settings)
  test_now = obslua.obs_data_get_string(settings, "test_now")
  load_config()
  local defs = {
    { "kosensai.pause.auto", "配信休止: 予定どおり", "auto" },
    { "kosensai.pause.on", "配信休止: 出す", "on" },
    { "kosensai.pause.off", "配信休止: 出さない", "off" },
  }
  for _, d in ipairs(defs) do
    local id = obslua.obs_hotkey_register_frontend(d[1], d[2], set_mode(d[3]))
    local saved = obslua.obs_data_get_array(settings, d[1])
    obslua.obs_hotkey_load(id, saved)
    obslua.obs_data_array_release(saved)
    hotkeys[d[1]] = id
  end
  obslua.obs_frontend_add_event_callback(on_event)
  attach_always_scene(false)
  paused = mode == "on" or (mode == "auto" and in_ng())
  apply_pause()
  obslua.timer_add(tick, 1000)
end

function script_save(settings)
  for name, id in pairs(hotkeys) do
    local arr = obslua.obs_hotkey_save(id)
    obslua.obs_data_set_array(settings, name, arr)
    obslua.obs_data_array_release(arr)
  end
end

function script_unload()
  obslua.timer_remove(tick)
  obslua.obs_set_output_source(CHANNEL, nil)
  if program ~= nil then
    obslua.obs_data_release(program)
  end
end
