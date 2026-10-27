-- 本部 OBS の音声の振り分け、会場ごとの配信休止・転換の画面、CM の自動表示、受信の確認と操作パネルのホットキー。
-- 動作は hosts/obs/README.md の 3. にある。ソースとシーンの名前は scenes.json(このファイルと同じフォルダ)から読む。

obs = obslua

-- 0 はトランジション、1〜6 はグローバル音声デバイスが使用する。
local CHANNEL = 20
-- トラック 1 のビット。OBS の Lua は LuaJIT(Lua 5.1)で、ビット演算子が無いため bit ライブラリを使用する。
local TRACK1 = 1

-- scenes.json の venues。{ { id = ..., name = ..., source = 映像と音声のソース }, ... }
local venues = {}
local venue_by_id = {}
-- scenes.json の audio。ch3 は会場の一覧(優先する順)。
local always_scene = nil
local ch3 = {}
local pauses = {} -- { { venue = ..., show = { ... }, hide = { ... }, on = false }, ... }
-- scenes.json の transition。
local transitions = {} -- { { venue = ..., show = { ... }, on = false }, ... }
local signal_lost = {} -- { { venue = ..., hide = { ... } }, ... }
local cm_corner = nil -- { scene = ..., source = ..., full_source = ..., lost_venue = ..., every_min = ..., show_sec = ... }
local monitor = nil -- { scene = ..., pages = { ... } }
-- scenes.json の panel.source。
local panel_source = nil
-- scenes.json の hotkeys(ホットキーの ID → キー)。
local hotkey_data = nil
-- 登録したホットキー。ID → { hotkey = obs のホットキーの ID, label = ... }。hotkey_list は表示の順の { id, label }。
local registered = {}
local hotkey_list = {}
-- 会場の映像が消えているか。映像のソースの名前 → { lost = ..., since = 最後に変わった時刻 }。
local lost = {}
-- 右下の CM。cm_auto は自動で出すかどうか、cm_shown_at は表示を始めた時刻(表示していなければ nil)、
-- cm_slot は最後に表示した回(毎時 every_min 分ごとの区切りの番号)。
local cm_auto = true
local cm_shown_at = nil
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

-- obs_data の key の配列 [{source}, ...] のソースの名前の一覧。
local function source_names(data, key)
  local names = {}
  each(data, key, function(x)
    table.insert(names, obslua.obs_data_get_string(x, "source"))
  end)
  return names
end

-- data の key に書かれた会場の id の会場。
local function venue_of(data, key)
  local id = obslua.obs_data_get_string(data, key)
  local venue = venue_by_id[id]
  if venue == nil then
    obslua.script_log(obslua.LOG_WARNING, "scenes.json の venues に " .. id .. " がない")
  end
  return venue
end

-- 前回の読み込みの on の状態(会場の id → on)。
local function states(list)
  local was = {}
  for _, x in ipairs(list) do
    was[x.venue.id] = x.on
  end
  return was
end

local function load_config()
  local scenes = load_json("scenes.json")
  if scenes == nil then
    return
  end
  venues = {}
  venue_by_id = {}
  each(scenes, "venues", function(item)
    local venue = {
      id = obslua.obs_data_get_string(item, "id"),
      name = obslua.obs_data_get_string(item, "name"),
      source = obslua.obs_data_get_string(item, "source"),
    }
    table.insert(venues, venue)
    venue_by_id[venue.id] = venue
  end)

  local audio = obslua.obs_data_get_obj(scenes, "audio")
  always_scene = obslua.obs_data_get_string(audio, "always")
  ch3 = {}
  each(audio, "ch3", function(item)
    table.insert(ch3, venue_of(item, "venue"))
  end)
  -- 読み直しても休止と転換の状態は残す。
  local was = states(pauses)
  pauses = {}
  each(audio, "pause", function(item)
    local venue = venue_of(item, "venue")
    table.insert(pauses, {
      venue = venue,
      show = source_names(item, "show"),
      hide = source_names(item, "hide"),
      on = was[venue.id] or false,
    })
  end)
  obslua.obs_data_release(audio)
  was = states(transitions)
  transitions = {}
  each(scenes, "transition", function(item)
    local venue = venue_of(item, "venue")
    table.insert(transitions, { venue = venue, show = source_names(item, "show"), on = was[venue.id] or false })
  end)
  signal_lost = {}
  each(scenes, "signal_lost", function(item)
    table.insert(signal_lost, { venue = venue_of(item, "venue"), hide = source_names(item, "hide") })
  end)

  cm_corner = nil
  local cm = obslua.obs_data_get_obj(scenes, "cm_corner")
  if cm ~= nil then
    cm_corner = {
      scene = obslua.obs_data_get_string(cm, "scene"),
      source = obslua.obs_data_get_string(cm, "source"),
      full_source = obslua.obs_data_get_string(cm, "full_source"),
      lost_venue = venue_of(cm, "lost_venue"),
      every_min = obslua.obs_data_get_int(cm, "every_min"),
      show_sec = obslua.obs_data_get_int(cm, "show_sec"),
    }
    obslua.obs_data_release(cm)
  end
  monitor = nil
  local mon = obslua.obs_data_get_obj(scenes, "monitor")
  if mon ~= nil then
    monitor = { scene = obslua.obs_data_get_string(mon, "scene"), pages = source_names(mon, "pages") }
    obslua.obs_data_release(mon)
  end
  panel_source = nil
  local panel = obslua.obs_data_get_obj(scenes, "panel")
  if panel ~= nil then
    panel_source = obslua.obs_data_get_string(panel, "source")
    obslua.obs_data_release(panel)
  end
  if hotkey_data ~= nil then
    obslua.obs_data_release(hotkey_data)
  end
  hotkey_data = obslua.obs_data_get_obj(scenes, "hotkeys")
  obslua.obs_data_release(scenes)
end

-- obs-multi-rtmp がプログラム以外のシーンを送出しても、そのシーンにしか無いソースの音声はミキサーに入らない。
-- 会場の音声を常にミキサーに入れるため、audio.always のシーンを出力チャンネルにつなぐ。操作パネルのブラウザ
-- ソースも、どこにも表示されていないと描画と操作の反映が止まるため、このシーンに置いている。
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

local function paused(venue)
  for _, p in ipairs(pauses) do
    if p.on and p.venue == venue then
      return true
    end
  end
  return false
end

-- Ch3(トラック 1)の音声と本部のモニター。休止中の会場は候補から外し、2 画面ではもう一方の会場の音声にする。
local function update_track1()
  local scene = obslua.obs_frontend_get_current_scene()
  if scene == nil then
    return
  end
  local found = {}
  collect(scene, found)
  obslua.obs_source_release(scene)

  local chosen = nil
  for _, venue in ipairs(ch3) do
    if chosen == nil and found[venue.source] and not paused(venue) then
      chosen = venue
    end
  end
  for _, venue in ipairs(ch3) do
    set_track1(venue.source, venue == chosen)
  end
end

-- 全シーンの name のソースの表示を切り替える。monitor.scene は受信を確かめるためのシーンなので、休止でも隠さない。
local function set_visible_everywhere(name, visible)
  local scenes = obslua.obs_frontend_get_scenes()
  for _, scene_source in ipairs(scenes) do
    if monitor == nil or obslua.obs_source_get_name(scene_source) ~= monitor.scene then
      local scene = obslua.obs_scene_from_source(scene_source)
      local items = obslua.obs_scene_enum_items(scene)
      for _, item in ipairs(items) do
        if obslua.obs_source_get_name(obslua.obs_sceneitem_get_source(item)) == name then
          obslua.obs_sceneitem_set_visible(item, visible)
        end
      end
      obslua.sceneitem_list_release(items)
    end
  end
  obslua.source_list_release(scenes)
end

-- 映像の幅が 0 なら、SRT が切れて映像が消えている。
local function width_zero(name)
  local source = obslua.obs_get_source_by_name(name)
  if source == nil then
    return false
  end
  local zero = obslua.obs_source_get_width(source) == 0
  obslua.obs_source_release(source)
  return zero
end

local function is_lost(venue)
  local state = lost[venue.source]
  return state ~= nil and state.lost
end

-- 各会場の映像が消えているかを確かめる。変わった会場があれば true を返す。
local function update_lost()
  local changed = false
  for _, venue in ipairs(venues) do
    local now = width_zero(venue.source)
    local state = lost[venue.source]
    if state == nil or state.lost ~= now then
      if state ~= nil then
        obslua.script_log(obslua.LOG_INFO, venue.source .. (now and " の映像が消えた" or " の映像が戻った"))
      end
      lost[venue.source] = { lost = now, since = os.time() }
      changed = true
    end
  end
  return changed
end

-- 休止・転換・signal_lost が扱うソースの表示を決め、全シーンに反映する。show のソースは
-- 休止中・転換中の会場が 1 つでもあれば表示し、hide のソースは隠す理由が 1 つでもあれば隠す。
local function apply_visibility()
  local visible = {}
  local function show(names, on)
    for _, name in ipairs(names) do
      visible[name] = visible[name] or on
    end
  end
  local function hide(names, on)
    for _, name in ipairs(names) do
      visible[name] = (visible[name] == nil or visible[name]) and not on
    end
  end
  for _, t in ipairs(transitions) do
    show(t.show, t.on)
  end
  for _, p in ipairs(pauses) do
    show(p.show, p.on)
    hide(p.hide, p.on)
  end
  for _, entry in ipairs(signal_lost) do
    hide(entry.hide, is_lost(entry.venue))
  end
  for name, v in pairs(visible) do
    set_visible_everywhere(name, v)
  end
end

-- 全シーンの休止の画面の表示と、休止する会場の音声のミュートを、各会場の休止の状態に合わせる。
-- 配信しない演目は時刻が押しや巻きでずれるため、休止は時刻ではなくホットキーで切り替える。
local function apply_pause()
  apply_visibility()
  for _, p in ipairs(pauses) do
    local audio = obslua.obs_get_source_by_name(p.venue.source)
    if audio ~= nil then
      obslua.obs_source_set_muted(audio, p.on)
      obslua.obs_source_release(audio)
    end
  end
  update_track1()
end

-- scene_name のシーンの name のソースの表示を切り替える。CM の小窓と全画面は cm_corner.scene にだけ置く。
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
      -- 遊撃の映像が消えるか休止して、休止の画面が出ている間は、全画面で出す。
      local venue = cm_corner.lost_venue
      local source = (is_lost(venue) or paused(venue)) and cm_corner.full_source or cm_corner.source
      -- スライドの画像が無ければ(幅が 0)出さない。
      if not width_zero(source) then
        cm_shown_at = os.time()
        set_visible_in(cm_corner.scene, source, true)
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

-- obs_data の配列に、fill で値を設定したオブジェクトを追加する。
local function push_object(arr, fill)
  local item = obslua.obs_data_create()
  fill(item)
  obslua.obs_data_array_push_back(arr, item)
  obslua.obs_data_release(item)
end

local function find_by_venue(list, venue)
  for _, x in ipairs(list) do
    if x.venue == venue then
      return x
    end
  end
  return nil
end

local function hotkey_key(id)
  return hotkey_data and obslua.obs_data_get_string(hotkey_data, id) or ""
end

-- monitor.pages のブラウザソースへ、会場ごとの状態({id, name, lost, since, paused, transition})と
-- ホットキーの一覧({id, key, label})を送る。paused・transition は、その会場に休止・転換がある時だけ入れる。
-- ページの読み込み(obs build の後等)を Lua から知る手段が無いため、変化の有無によらず毎秒送る。
local function send_status()
  if monitor == nil then
    return
  end
  local data = obslua.obs_data_create()
  local list = obslua.obs_data_array_create()
  for _, venue in ipairs(venues) do
    push_object(list, function(item)
      local state = lost[venue.source]
      obslua.obs_data_set_string(item, "id", venue.id)
      obslua.obs_data_set_string(item, "name", venue.name)
      obslua.obs_data_set_bool(item, "lost", state.lost)
      obslua.obs_data_set_int(item, "since", state.since)
      local p = find_by_venue(pauses, venue)
      if p ~= nil then
        obslua.obs_data_set_bool(item, "paused", p.on)
      end
      local t = find_by_venue(transitions, venue)
      if t ~= nil then
        obslua.obs_data_set_bool(item, "transition", t.on)
      end
    end)
  end
  obslua.obs_data_set_array(data, "venues", list)
  obslua.obs_data_array_release(list)
  obslua.obs_data_set_bool(data, "cm_auto", cm_auto)
  local hotkeys = obslua.obs_data_array_create()
  for _, h in ipairs(hotkey_list) do
    push_object(hotkeys, function(item)
      obslua.obs_data_set_string(item, "id", h.id)
      obslua.obs_data_set_string(item, "key", hotkey_key(h.id))
      obslua.obs_data_set_string(item, "label", h.label)
    end)
  end
  obslua.obs_data_set_array(data, "hotkeys", hotkeys)
  obslua.obs_data_array_release(hotkeys)
  local json = obslua.obs_data_get_json(data)
  obslua.obs_data_release(data)
  -- obs-browser の javascript_event は、そのブラウザソースのページに CustomEvent を送る(detail は JSON を解釈した値)。
  for _, name in ipairs(monitor.pages) do
    local source = obslua.obs_get_source_by_name(name)
    if source ~= nil then
      local cd = obslua.calldata_create()
      obslua.calldata_set_string(cd, "eventName", "kosensaiStatus")
      obslua.calldata_set_string(cd, "jsonString", json)
      obslua.proc_handler_call(obslua.obs_source_get_proc_handler(source), "javascript_event", cd)
      obslua.calldata_destroy(cd)
      obslua.obs_source_release(source)
    end
  end
end

local function open_monitor(pressed)
  if pressed and monitor ~= nil then
    -- monitor は -1 でウィンドウ、geometry は空で既定の大きさ。
    obslua.obs_frontend_open_projector("Scene", -1, "", monitor.scene)
  end
end

local function open_panel(pressed)
  if not pressed or panel_source == nil then
    return
  end
  local source = obslua.obs_get_source_by_name(panel_source)
  if source == nil then
    obslua.script_log(obslua.LOG_WARNING, panel_source .. " のソースがない")
    return
  end
  obslua.obs_frontend_open_source_interaction(source)
  obslua.obs_source_release(source)
end

local function set_paused(id, on)
  return function(pressed)
    local p = pressed and find_by_venue(pauses, venue_by_id[id])
    if p and p.on ~= on then
      p.on = on
      obslua.script_log(obslua.LOG_INFO, p.venue.name .. (on and " の配信休止を表示した" or " の配信休止を解除した"))
      apply_pause()
    end
  end
end

-- 演目の間の転換は予定表に項目が無いため、転換の画面は時刻ではなくホットキーで切り替える。
local function set_transition(id, on)
  return function(pressed)
    local t = pressed and find_by_venue(transitions, venue_by_id[id])
    if t and t.on ~= on then
      t.on = on
      obslua.script_log(obslua.LOG_INFO, t.venue.name .. (on and " の転換の画面を表示した" or " の転換の画面を消した"))
      apply_visibility()
    end
  end
end

-- 登録するホットキーの一覧(表示の順)。{ { id, label, callback }, ... }
local function hotkey_specs()
  local specs = {}
  local function add(id, label, callback)
    table.insert(specs, { id = id, label = label, callback = callback })
  end
  add("monitor.open", "受信の確認を開く", open_monitor)
  add("panel.open", "操作パネルを開く", open_panel)
  for _, t in ipairs(transitions) do
    add("transition." .. t.venue.id .. ".on", t.venue.name .. " 転換: 出す", set_transition(t.venue.id, true))
    add("transition." .. t.venue.id .. ".off", t.venue.name .. " 転換: 消す", set_transition(t.venue.id, false))
  end
  for _, p in ipairs(pauses) do
    add("pause." .. p.venue.id .. ".on", p.venue.name .. " 休止: 出す", set_paused(p.venue.id, true))
    add("pause." .. p.venue.id .. ".off", p.venue.name .. " 休止: 消す", set_paused(p.venue.id, false))
  end
  add("cm.on", "CM 小窓: 自動で出す", set_cm_auto(true))
  add("cm.off", "CM 小窓: 出さない", set_cm_auto(false))
  return specs
end

-- hotkey_specs のホットキーを登録し、scenes.json の hotkeys のキーを割り当てる。OBS の設定画面で変えたキーは、
-- 読み込みのたびに scenes.json の値に戻る。読み直しで無くなったホットキーは登録を解除する。
local function register_hotkeys()
  local wanted = {}
  hotkey_list = {}
  for _, spec in ipairs(hotkey_specs()) do
    wanted[spec.id] = true
    table.insert(hotkey_list, { id = spec.id, label = spec.label })
    local r = registered[spec.id]
    if r ~= nil and r.label ~= spec.label then
      obslua.obs_hotkey_unregister(r.hotkey)
      r = nil
    end
    if r == nil then
      r = { hotkey = obslua.obs_hotkey_register_frontend("kosensai." .. spec.id, spec.label, spec.callback), label = spec.label }
      registered[spec.id] = r
    end
    local binding = obslua.obs_data_array_create()
    if hotkey_key(spec.id) ~= "" then
      local key = obslua.obs_data_create()
      obslua.obs_data_set_string(key, "key", "OBS_KEY_" .. hotkey_key(spec.id))
      obslua.obs_data_array_push_back(binding, key)
      obslua.obs_data_release(key)
    end
    obslua.obs_hotkey_load(r.hotkey, binding)
    obslua.obs_data_array_release(binding)
  end
  for id, r in pairs(registered) do
    if not wanted[id] then
      obslua.obs_hotkey_unregister(r.hotkey)
      registered[id] = nil
    end
  end
end

local function tick()
  if update_lost() then
    apply_visibility()
  end
  update_cm()
  send_status()
end

local function on_event(event)
  if event == obslua.OBS_FRONTEND_EVENT_FINISHED_LOADING or event == obslua.OBS_FRONTEND_EVENT_SCENE_COLLECTION_CHANGED then
    attach_always_scene(true)
    apply_pause()
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
    .. "ホットキーで会場ごとに転換の画面(次の出演)を表示する。"
    .. "遊撃の映像が消えている間は、遊撃のテロップを隠す。"
end

function script_properties()
  local props = obslua.obs_properties_create()
  obslua.obs_properties_add_button(props, "reload", "scenes.json を読み直す", function()
    load_config()
    register_hotkeys()
    update_lost()
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
  cm_auto = obslua.obs_data_get_bool(settings, "cm_auto")
  load_config()
  for _, p in ipairs(pauses) do
    p.on = obslua.obs_data_get_bool(settings, "paused_" .. p.venue.id)
  end
  for _, t in ipairs(transitions) do
    t.on = obslua.obs_data_get_bool(settings, "transition_" .. t.venue.id)
  end
  register_hotkeys()
  update_lost()
  obslua.obs_frontend_add_event_callback(on_event)
  attach_always_scene(false)
  apply_pause()
  -- 起動した回は出さず、次の区切りから出す。
  cm_slot = cm_corner and math.floor(os.time() / (cm_corner.every_min * 60))
  obslua.timer_add(tick, 1000)
end

function script_save(settings)
  for _, p in ipairs(pauses) do
    obslua.obs_data_set_bool(settings, "paused_" .. p.venue.id, p.on)
  end
  for _, t in ipairs(transitions) do
    obslua.obs_data_set_bool(settings, "transition_" .. t.venue.id, t.on)
  end
  obslua.obs_data_set_bool(settings, "cm_auto", cm_auto)
end

function script_unload()
  obslua.timer_remove(tick)
  obslua.obs_set_output_source(CHANNEL, nil)
  if hotkey_data ~= nil then
    obslua.obs_data_release(hotkey_data)
  end
end
