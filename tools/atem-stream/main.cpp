// ATEM の配信設定を Blackmagic ATEM Switchers SDK 経由で読み書きする CLI。
// usage は printUsage() を参照。config.json と .env から値を決める処理は atem.py が行う。
#include "BMDSwitcherAPI.h"
#include <CoreFoundation/CoreFoundation.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

static std::string toStd(CFStringRef r) {
	if (!r) return "(null)";
	char buf[2048];
	CFStringGetCString(r, buf, sizeof buf, kCFStringEncodingUTF8);
	CFRelease(r);
	return buf;
}

// CFString を生成し、スコープを抜ける時に解放する
struct CFStr {
	CFStringRef ref;
	explicit CFStr(const char* c) : ref(CFStringCreateWithCString(nullptr, c, kCFStringEncodingUTF8)) {}
	~CFStr() { CFRelease(ref); }
	CFStr(const CFStr&) = delete;
	CFStr& operator=(const CFStr&) = delete;
};

// SDK のコールバックは run loop 上で配送されるため、設定の反映を待つ間は run loop を回す
static void pump(double sec) { CFRunLoopRunInMode(kCFRunLoopDefaultMode, sec, false); }

static const char* stateName(BMDSwitcherStreamRTMPState st) {
	switch (st) {
		case bmdSwitcherStreamRTMPStateIdle: return "idle";
		case bmdSwitcherStreamRTMPStateConnecting: return "connecting";
		case bmdSwitcherStreamRTMPStateStreaming: return "streaming";
		case bmdSwitcherStreamRTMPStateStopping: return "stopping";
		default: return "?";
	}
}

static std::string fourcc(uint32_t v) {
	char c[5] = {(char)(v >> 24), (char)(v >> 16), (char)(v >> 8), (char)v, 0};
	return c;
}

// 失敗した呼び出しを標準エラー出力へ出し、最初の失敗の HRESULT を保持する
static HRESULT firstError = S_OK;
static void check(const char* what, HRESULT hr) {
	if (hr == S_OK) return;
	fprintf(stderr, "%s: 0x%08x\n", what, (unsigned)hr);
	if (firstError == S_OK) firstError = hr;
}

static void dump(IBMDSwitcherStreamRTMP* st) {
	CFStringRef r;
	bool b;
	st->GetServiceName(&r); printf("service : %s\n", toStd(r).c_str());
	st->GetUrl(&r);         printf("url     : %s\n", toStd(r).c_str());
	st->GetKey(&r);         printf("key     : %s\n", toStd(r).c_str());
	{
		CFStringRef user, pass;
		st->GetAuthentication(&user, &pass);
		printf("auth    : %s / %s\n", toStd(user).c_str(), toStd(pass).c_str());
	}
	if (st->GetSRTExtensions(&r) == S_OK) printf("srt-ext : %s\n", toStd(r).c_str());
	st->CanStreamSRT(&b);  printf("canSRT  : %d\n", b);
	st->GetLowLatency(&b); printf("lowLat  : %d\n", b);
	uint32_t lo, hi;
	st->GetVideoBitrates(&lo, &hi); printf("vbitrate: %u / %u\n", lo, hi);
	// 品質（ATEM Software Control の「品質」）。GetVideoBitrates とは別に保持されている。
	// SetVideoBitrates は GetVideoBitrates の値だけを変え、この値は変えない（fw 10.3 で確認）。
	// keyFrameInterval は単位が SDK に記載されていないため表示しない。
	{
		CFStringRef name;
		uint32_t vlo, vhi, alo, ahi, keyframe;
		bool lowLatency;
		BMDSwitcherVideoMode mode;
		BMDSwitcherVideoCodec codec;
		if (st->GetProfile(&name, &vlo, &vhi, &alo, &ahi, &lowLatency, &mode, &codec, &keyframe) == S_OK)
			printf("profile : %s video=%u/%u audio=%u/%u mode=%s codec=%s lowLat=%d\n",
			       toStd(name).c_str(), vlo, vhi, alo, ahi, fourcc(mode).c_str(), fourcc(codec).c_str(), lowLatency);
	}
	BMDSwitcherStreamRTMPState state;
	BMDSwitcherStreamRTMPError err;
	st->GetStatus(&state, &err);
	printf("status  : %s (err=%s)\n", stateName(state), fourcc(err).c_str());
}

static void printUsage(const char* prog) {
	fprintf(stderr,
		"usage: %s <ATEM の IP> <command>\n"
		"  get                        配信設定と状態を表示する\n"
		"  set <service> <url> <key>  サービス名・URL・キーを設定する (例: \"Custom URL H.264\" srt://host:9001 \"\")\n"
		"  passphrase <値>            SRT のパスフレーズを設定する\n"
		"  start | stop               配信を開始・停止する\n"
		"  watch <秒>                 状態とビットレートを 1 秒ごとに表示する\n"
		"配信中 (connecting を含む) は set / passphrase が E_FAIL (0x80000008) になる。\n",
		prog);
}

int main(int argc, char** argv) {
	if (argc < 3) { printUsage(argv[0]); return 2; }
	const char* ip = argv[1];
	const char* cmd = argv[2];
	bool ok = (!strcmp(cmd, "get") || !strcmp(cmd, "start") || !strcmp(cmd, "stop") ||
	           !strcmp(cmd, "watch") || (!strcmp(cmd, "set") && argc >= 6) ||
	           (!strcmp(cmd, "passphrase") && argc >= 4));
	if (!ok) { printUsage(argv[0]); return 2; }

	IBMDSwitcherDiscovery* disc = CreateBMDSwitcherDiscoveryInstance();
	if (!disc) { fprintf(stderr, "CreateBMDSwitcherDiscoveryInstance failed\n"); return 1; }

	IBMDSwitcher* sw = nullptr;
	BMDSwitcherConnectToFailure fail;
	{
		CFStr cfIp(ip);
		HRESULT hr = disc->ConnectTo(cfIp.ref, &sw, &fail);
		if (hr != S_OK) {
			fprintf(stderr, "ConnectTo %s failed: 0x%08x (%s)\n", ip, (unsigned)hr, fourcc(fail).c_str());
			return 1;
		}
	}

	IBMDSwitcherStreamRTMP* st = nullptr;
	if (sw->QueryInterface(IID_IBMDSwitcherStreamRTMP, (void**)&st) != S_OK) {
		fprintf(stderr, "このスイッチャーは配信インターフェースを持たない\n");
		return 1;
	}

	if (!strcmp(cmd, "get")) {
		dump(st);
	} else if (!strcmp(cmd, "set")) {
		CFStr service(argv[3]), url(argv[4]), key(argv[5]);
		check("SetServiceName", st->SetServiceName(service.ref));
		check("SetUrl", st->SetUrl(url.ref));
		check("SetKey", st->SetKey(key.ref));
		pump(1.5);
		dump(st);
	} else if (!strcmp(cmd, "passphrase")) {
		// SRT のパスフレーズは SetAuthentication の password に対応する。
		// URL の ?passphrase= と SetSRTExtensions は ATEM が無視する
		CFStr user(""), pass(argv[3]);
		check("SetAuthentication", st->SetAuthentication(user.ref, pass.ref));
		pump(1.0);
		dump(st);
	} else if (!strcmp(cmd, "start")) {
		check("StartStreaming", st->StartStreaming());
		pump(1.0);
		dump(st);
	} else if (!strcmp(cmd, "stop")) {
		check("StopStreaming", st->StopStreaming());
		pump(1.0);
		dump(st);
	} else if (!strcmp(cmd, "watch")) {
		int sec = argc >= 4 ? atoi(argv[3]) : 10;
		for (int i = 0; i < sec; i++) {
			BMDSwitcherStreamRTMPState state;
			BMDSwitcherStreamRTMPError err;
			uint32_t bitrate = 0;
			double cache = 0;
			st->GetStatus(&state, &err);
			st->GetEncodingBitrate(&bitrate);
			st->GetCacheUsed(&cache);
			printf("%2d %s bitrate=%u cache=%.2f\n", i, stateName(state), bitrate, cache);
			fflush(stdout);
			pump(1.0);
		}
	}

	st->Release();
	sw->Release();
	disc->Release();
	return firstError == S_OK ? 0 : 1;
}
