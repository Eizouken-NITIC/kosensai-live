-- 本部 OBS の音声の振り分けと、第一体育館の配信休止。OBS の「ツール → スクリプト」でこのファイルを追加する。
--
-- 1. 「[音声] 常時」シーンを出力チャンネルにつなぎ、どのシーンをプログラムに出していても
--    Ch1・Ch2 の音声がミキサーに入るようにする。obs-multi-rtmp がプログラム以外のシーンを
--    送出しても、そのシーンにしか無いソースの音声はミキサーに入らないため。
--    シーンの中の映像は画面の外に置いてあるので、プログラムには何も映らない。
-- 2. Ch3(トラック 1)には、プログラムのシーン(入れ子を含む)に表示されているソースのうち、
--    SOURCES の順で最初に見つかった会場の音声だけを入れる。
-- 3. 第一体育館の配信をしない時間(overlays/program.js の種類が ng の項目)は、
--    「配信休止」のソースを全シーンで表示し、Ch1 の音声を Ch1(トラック 2)と Ch3(トラック 1)から外す。
--    押しや巻きに備え、ホットキーで「休止を出す」「休止を出さない」「予定どおり」を切り替えられる。
--
-- 休止の判定はこのスクリプトだけが行う。overlays/pause.html は再開の時刻を出すだけで、
-- 表示するかどうかは決めない。

obs = obslua

local ALWAYS_SCENE = "[音声] 常時"
-- 0 はトランジション、1〜6 はグローバル音声デバイスが使用する。
local CHANNEL = 20
-- 表示中かどうかを調べるソース → トラック 1 に入れる音声のソース
local SOURCES = {
  { "Ch1 ATEM", "Ch1 音声 (USB)" },
  { "Ch2 iPhone", "Ch2 iPhone" },
}
local CH1_AUDIO = "Ch1 音声 (USB)"
local PAUSE_SOURCE = "配信休止"
-- トラックのビット。OBS の Lua は LuaJIT(Lua 5.1)で、ビット演算子が無いため bit ライブラリを使用する。
local TRACK1 = 1
local TRACK2 = 2

-- 休止の切り替え。auto は program.js の時刻に従う。on と off はホットキーで固定した状態。
local mode = "auto"
-- program.js の ng の時間。{ ["2026-10-24"] = { { "13:50", "14:15" }, ... } }
local ng_ranges = {}
-- 確認用の時刻("2026-10-24 13:55" の形)。空なら現在の時刻を使用する。
local test_now = ""
local paused = false
local hotkeys = {}

local function script_dir()
  return script_path():gsub("[/\\]$", "")
end

-- program.js の ch1 の出演順から、種類が ng の項目の開始〜次の項目の開始(最後なら end)を読む。
-- program.js は JavaScript なので、ch1 の節の各行を文字列のパターンで読む。
local function load_program()
  local path = script_dir() .. "/overlays/program.js"
  local file = io.open(path, "r")
  if file == nil then
    obslua.script_log(obslua.LOG_WARNING, path .. " を開けません")
    return
  end
  local days, ends, day, in_ch1 = {}, {}, nil, false
  for line in file:lines() do
    if line:match("^%s*ch1:%s*{") then
      in_ch1 = true
    elseif line:match("^%s*ch2:%s*{") then
      in_ch1 = false
    elseif in_ch1 then
      local key = line:match("'(%d%d%d%d%-%d%d%-%d%d)':%s*{")
      if key then
        day = key
        days[day] = {}
      end
      local e = line:match("end:%s*'(%d%d:%d%d)'")
      if e and day then
        ends[day] = e
      end
      local t, kind = line:match("%[%s*'(%d%d:%d%d)',%s*'.-',%s*'(%a+)'%s*%]")
      if t and day then
        table.insert(days[day], { t, kind })
      end
    end
  end
  file:close()
  ng_ranges = {}
  local count = 0
  for key, items in pairs(days) do
    ng_ranges[key] = {}
    for i, it in ipairs(items) do
      if it[2] == "ng" then
        local stop = items[i + 1] and items[i + 1][1] or ends[key]
        table.insert(ng_ranges[key], { it[1], stop })
        count = count + 1
      end
    end
  end
  obslua.script_log(obslua.LOG_INFO, "program.js から配信しない時間を " .. count .. " 件読みました")
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
  for _, r in ipairs(ng_ranges[key] or {}) do
    if r[1] <= hm and hm < r[2] then
      return true
    end
  end
  return false
end

local function attach_always_scene(warn)
  local source = obslua.obs_get_source_by_name(ALWAYS_SCENE)
  obslua.obs_set_output_source(CHANNEL, source)
  if source ~= nil then
    obslua.obs_source_release(source)
  elseif warn then
    obslua.script_log(obslua.LOG_WARNING, ALWAYS_SCENE .. " シーンがありません")
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

local function set_track(name, bit_value, on)
  local source = obslua.obs_get_source_by_name(name)
  if source == nil then
    return
  end
  local mixers = obslua.obs_source_get_audio_mixers(source)
  if on then
    mixers = bit.bor(mixers, bit_value)
  else
    mixers = bit.band(mixers, bit.bnot(bit_value))
  end
  obslua.obs_source_set_audio_mixers(source, mixers)
  obslua.obs_source_release(source)
end

-- Ch3(トラック 1)の音声。休止中は Ch1 の音声を候補から外す。
local function update_track1()
  local program = obslua.obs_frontend_get_current_scene()
  if program == nil then
    return
  end
  local found = {}
  collect(program, found)
  obslua.obs_source_release(program)

  local chosen = nil
  for _, pair in ipairs(SOURCES) do
    if chosen == nil and found[pair[1]] and not (paused and pair[2] == CH1_AUDIO) then
      chosen = pair[2]
    end
  end
  for _, pair in ipairs(SOURCES) do
    set_track(pair[2], TRACK1, pair[2] == chosen)
  end
end

-- 全シーンの「配信休止」の表示と、Ch1 の音声の Ch1(トラック 2)への出し入れを、paused に合わせる。
local function apply_pause()
  local scenes = obslua.obs_frontend_get_scenes()
  for _, scene_source in ipairs(scenes) do
    local scene = obslua.obs_scene_from_source(scene_source)
    local items = obslua.obs_scene_enum_items(scene)
    for _, item in ipairs(items) do
      if obslua.obs_source_get_name(obslua.obs_sceneitem_get_source(item)) == PAUSE_SOURCE then
        obslua.obs_sceneitem_set_visible(item, paused)
      end
    end
    obslua.sceneitem_list_release(items)
  end
  obslua.source_list_release(scenes)
  set_track(CH1_AUDIO, TRACK2, not paused)
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
    .. "第一体育館の配信をしない時間は「配信休止」を表示し、Ch1 の音声を外す。"
end

function script_properties()
  local props = obslua.obs_properties_create()
  obslua.obs_properties_add_text(props, "test_now", "確認用の時刻(例 2026-10-24 13:55、空なら現在)", obslua.OBS_TEXT_DEFAULT)
  obslua.obs_properties_add_button(props, "reload", "program.js を読み直す", function()
    load_program()
    tick()
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
  load_program()
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
end
