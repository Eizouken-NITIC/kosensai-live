-- 本部 OBS の音声の振り分け。OBS の「ツール → スクリプト」でこのファイルを追加する。
--
-- 1. 「[音声] 常時」シーンを出力チャンネルにつなぎ、どのシーンをプログラムに出していても
--    Ch1・Ch2 の音声がミキサーに入るようにする。obs-multi-rtmp がプログラム以外のシーンを
--    送出しても、そのシーンにしか無いソースの音声はミキサーに入らないため。
--    シーンの中の映像は画面の外に置いてあるので、プログラムには何も映らない。
-- 2. Ch3(トラック 1)には、プログラムのシーン(入れ子を含む)に表示されているソースのうち、
--    SOURCES の順で最初に見つかった会場の音声だけを入れる。Ch1 = トラック 2、
--    Ch2 = トラック 3 には触れない。

obs = obslua

local ALWAYS_SCENE = "[音声] 常時"
-- 0 はトランジション、1〜6 はグローバル音声デバイスが使用する。
local CHANNEL = 20
-- 表示中かどうかを調べるソース → トラック 1 に入れる音声のソース
local SOURCES = {
  { "Ch1 ATEM", "Ch1 音声 (USB)" },
  { "Ch2 iPhone", "Ch2 iPhone" },
}
local TRACK1 = 1 -- トラック 1 のビット

-- OBS の起動時はスクリプトの読み込みがシーンより先のため、warn は読み込み完了後だけ true にする。
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
    if chosen == nil and found[pair[1]] then
      chosen = pair[2]
    end
  end
  for _, pair in ipairs(SOURCES) do
    local source = obslua.obs_get_source_by_name(pair[2])
    if source ~= nil then
      local mixers = obslua.obs_source_get_audio_mixers(source)
      -- OBS の Lua は LuaJIT(Lua 5.1)で、ビット演算子が無いため bit ライブラリを使用する。
      if pair[2] == chosen then
        mixers = bit.bor(mixers, TRACK1)
      else
        mixers = bit.band(mixers, bit.bnot(TRACK1))
      end
      obslua.obs_source_set_audio_mixers(source, mixers)
      obslua.obs_source_release(source)
    end
  end
end

local function on_event(event)
  if event == obslua.OBS_FRONTEND_EVENT_FINISHED_LOADING or event == obslua.OBS_FRONTEND_EVENT_SCENE_COLLECTION_CHANGED then
    attach_always_scene(true)
    update_track1()
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
  return "「[音声] 常時」をミキサーに常時入れ、Ch3(トラック 1)の音声を表示中の会場に合わせる"
end

function script_load(settings)
  obslua.obs_frontend_add_event_callback(on_event)
  attach_always_scene(false)
  update_track1()
end

function script_unload()
  obslua.obs_set_output_source(CHANNEL, nil)
end
