// ============================================================
// MOTİFTEN ŞARKIYA
// Tiklanacaklar -> Drag & Drop -> Sesler
// ============================================================
//
// Family isimleri:
//   tiklanacaklar : sürüklenebilir Sprite'lar
//   sesler        : bırakma hedefleri
//
// Özellikler:
//   • Mouse / touch / pen ile sürükleme
//   • Sürüklerken büyüme ve hafif dönüş
//   • Hedefin üzerine gelince hedef animasyonu
//   • sesler family'sine bırakınca frame eşleştirme
//   • Yanlış yere bırakınca eski konuma geri dönüş
//   • Başarılı bırakmada bounce efekti
// ============================================================


const CONFIG = {
	DRAG_FAMILY: "tiklanacaklar",
	TARGET_FAMILY: "sesler",

	// Sürükleme sırasında büyütme
	DRAG_SCALE: 1.08,

	// Sürükleme sırasında hafif eğim
	DRAG_ROTATION: 0.025,

	// Yanlış bırakmada geri dönüş süresi
	RETURN_TIME: 0.24,

	// Başarılı bırakma efekti
	SUCCESS_TIME: 0.20,

	// Animasyon yumuşaklığı
	EASE_POWER: 3,

	// Sprite adına göre sesler frame eşleştirmesi
	FRAME_MAP: {
		alkis: 1,
		bass: 2,
		beat_box: 3,
		bell: 4,
		brass: 5,
		davul: 6,
		elektro_gitar: 7,
		piano: 8,
		tef: 9,
		tumba: 10,
		ukulele: 11,
		vokal: 12,
		zil: 13
	},

	// Arayüz / layer / layout isimleri
	UI: {
		FORWARD_BUTTON: "ileri",
		HOME_BUTTON: "anasayfa",
		START_BUTTON: "basla",
		LISTEN_BUTTON: "dinle",
		// Construct'taki nesne/animasyon adlarında kullanılabilecek karşılıklar.
		MELODY_BUTTONS: ["ezgi", "ezgi_sprite", "ezgiyi_dinle"],
		ARRAY_OBJECT: "array",
		STOP_BUTTONS: ["soundslar_dur", "soundslar dur", "soundslarDur", "dur"],
		MOTIFS_LAYER: "motifler",
		LISTEN_LAYER: "ezgini_dinle",
		FINAL_INSTRUCTION: "son_yonerge",
		INTRO_LAYOUT: "giriş",
		GAME_LAYOUT: "oyun",

		// Giriş ekranındaki "basla" nesnesini tıklanabilir olduğunu
		// belli etmek için kullanılan etkileşim efekti.
		START_HINT_SCALE: 1.08,
		START_HINT_ANGLE: 0.018,
		START_HINT_DURATION: 1.35,
		START_HINT_PAUSE: 0.45
	}
};


// ============================================================
// GLOBAL STATE
// ============================================================

const state = {
	runtime: null,
	drag: null,
	initialized: false,
	fx: [],

	// Dinle butonuyla başlayan sıralı ses oynatma durumu.
	audioSequence: {
		playing: false,
		token: 0,
		currentSource: null,
		shakeToken: 0,
		bufferCache: new Map(),
		retryTimer: null
	}
};


// ============================================================
// CONSTRUCT 3 BAŞLANGIÇ
// ============================================================

runOnStartup(async runtime =>
{
	state.runtime = runtime;

	runtime.addEventListener(
		"beforeprojectstart",
		() => OnBeforeProjectStart(runtime)
	);
});


// ============================================================
// PROJE BAŞLAMADAN HEMEN ÖNCE
// ============================================================

async function OnBeforeProjectStart(runtime)
{
	if (state.initialized)
		return;

	state.initialized = true;
	state.runtime = runtime;


	// Mouse
	// Touch
	// Pen
	// hepsi için çalışır.

	runtime.addEventListener(
		"pointerdown",
		e => onPointerDown(runtime, e)
	);

	runtime.addEventListener(
		"pointermove",
		e => onPointerMove(runtime, e)
	);

	runtime.addEventListener(
		"pointerup",
		e => onPointerUp(runtime, e)
	);

	runtime.addEventListener(
		"pointercancel",
		e => onPointerCancel(runtime, e)
	);

	runtime.addEventListener(
		"tick",
		() => Tick(runtime)
	);

	// Her layout başlangıcında gerekli başlangıç durumlarını uygula.
	runtime.addEventListener(
		"beforeanylayoutstart",
		e => OnBeforeAnyLayoutStart(runtime, e)
	);


	console.info(
		"[motiften_sarkiya] Drag & Drop sistemi hazır."
	);
}


// ============================================================
// HER LAYOUT BAŞLANGICI
// ============================================================

function OnBeforeAnyLayoutStart(runtime, e)
{
	const layout = e?.layout ?? runtime.layout;

	if (!layout)
		return;

	const layoutName = String(layout.name ?? "").trim().toLowerCase();

	// Giriş ekranında "basla" butonuna sürekli, yumuşak bir
	// nefes alma/pulse efekti ver. Böylece nesnenin tıklanabilir
	// olduğu görsel olarak anlaşılır.
	const introLayoutName = String(CONFIG.UI.INTRO_LAYOUT).trim().toLowerCase();

	if (layoutName === introLayoutName)
	{
		startStartButtonHint(runtime, layout);
	}
	else
{
		stopStartButtonHint();
	}
	const gameLayoutName = String(CONFIG.UI.GAME_LAYOUT).trim().toLowerCase();

	// Oyun layout'u her başladığında başlangıç görünümüne dön.
	if (layoutName === gameLayoutName)
	{
		stopSoundSequence();
		state.drag = null;

		setLayerVisibleOnLayout(
			layout,
			CONFIG.UI.MOTIFS_LAYER,
			true
		);

		setLayerVisibleOnLayout(
			layout,
			CONFIG.UI.LISTEN_LAYER,
			false
		);

		console.info(
			"[motiften_sarkiya] Oyun layout başlangıcı: motifler visible, ezgini_dinle invisible."
		);
	}
}


function setLayerVisibleOnLayout(layout, layerName, visible)
{
	try
	{
		const layer = layout?.getLayer?.(layerName);

		if (!layer)
		{
			console.warn(
				`[motiften_sarkiya] Layer bulunamadı: ${layerName}`
			);
			return false;
		}

		layer.isVisible = visible;
		return true;
	}
	catch (error)
	{
		console.warn(
			`[motiften_sarkiya] Layer görünürlüğü değiştirilemedi: ${layerName}`,
			error
		);
		return false;
	}
}


// ============================================================
// EVENT SHEET'TEN ÇAĞRILABİLECEK BAŞLATMA FONKSİYONU
// ============================================================

globalThis.MotiftenSarkiyaInit = function(runtime)
{
	if (!state.initialized)
	{
		OnBeforeProjectStart(runtime);
	}
};


// ============================================================
// FAMILY AL
// ============================================================

function getFamily(runtime, name)
{
	return runtime.objects?.[name] ?? null;
}


// ============================================================
// SÜRÜKLEME NOKTASINI LAYER KOORDİNATINA ÇEVİR
// ============================================================

function getWorldPoint(runtime, instance, e)
{
	if (
		!instance?.layer ||
		typeof instance.layer.cssPxToLayer !== "function"
	)
	{
		return [
			instance?.x ?? 0,
			instance?.y ?? 0
		];
	}


	return instance.layer.cssPxToLayer(
		e.clientX,
		e.clientY,
		instance.z ?? 0
	);
}


// ============================================================
// TIKLANACAKLAR FAMILY
// ============================================================

function getDragInstances(runtime)
{
	const family = getFamily(
		runtime,
		CONFIG.DRAG_FAMILY
	);

	return family
		? family.getAllInstances()
		: [];
}


// ============================================================
// SESLER FAMILY
// ============================================================

function getTargetInstances(runtime)
{
	const family = getFamily(
		runtime,
		CONFIG.TARGET_FAMILY
	);

	return family
		? family.getAllInstances()
		: [];
}


// ============================================================
// TIKLANAN SPRITE'I BUL
// ============================================================

function pickDraggable(runtime, e)
{
	const [
		x,
		y
	] = getPointerLayerPosition(runtime, e);


	const list = getDragInstances(runtime);


	// Üstte bulunan Sprite önce kontrol edilir.
	for (
		let i = list.length - 1;
		i >= 0;
		i--
	)
	{
		const inst = list[i];


		if (!inst || inst.isDestroyed)
			continue;


		if (inst.isVisible === false)
			continue;


		if (
			typeof inst.containsPoint === "function" &&
			inst.containsPoint(x, y)
		)
		{
			return inst;
		}
	}


	return null;
}


// ============================================================
// POINTER KOORDİNATI
// ============================================================

function getPointerLayerPosition(runtime, e)
{
	const all = getDragInstances(runtime);


	const ref =
		all.find(x => x?.layer) ||
		getTargetInstances(runtime)
			.find(x => x?.layer);


	if (ref?.layer?.cssPxToLayer)
	{
		return ref.layer.cssPxToLayer(
			e.clientX,
			e.clientY,
			ref.z ?? 0
		);
	}


	return [
		e.clientX,
		e.clientY
	];
}


// ============================================================
// POINTER DOWN
// ============================================================

function onPointerDown(runtime, e)
{
	// Aynı anda ikinci işlem başlamasın.
	if (state.drag)
		return;

	// --------------------------------------------------------
	// ARAYÜZ BUTONLARI
	// --------------------------------------------------------

	if (pickNamedObjectAtPointer(runtime, e, CONFIG.UI.LISTEN_BUTTON))
	{
		const listenButton = pickNamedObjectAtPointer(
			runtime, e, CONFIG.UI.LISTEN_BUTTON
		);

		if (listenButton && Math.abs(Number(listenButton.opacity) - 50) < 0.01)
			startDraggableShake(runtime);

		startSoundSequence(runtime);
		preventPointerDefault(e);
		return;
	}

	// ezgi Sprite'ı, dinle butonuyla tamamen aynı ses sırasını çalar.
	if (pickMelodyAtPointer(runtime, e))
	{
		console.info(
			"[motiften_sarkiya] EZGI tıklandı. DINLE ile aynı ses sırası başlatılıyor."
		);
		startSoundSequence(runtime);
		preventPointerDefault(e);
		return;
	}

	if (pickAnyNamedObjectAtPointer(runtime, e, CONFIG.UI.STOP_BUTTONS))
	{
		stopSoundSequence();
		preventPointerDefault(e);
		return;
	}

	//if (pickNamedObjectAtPointer(runtime, e, CONFIG.UI.FORWARD_BUTTON))
	//{
	//	handleForwardButton(runtime);
		//preventPointerDefault(e);
		//return;
	//}

	if (pickNamedObjectAtPointer(runtime, e, CONFIG.UI.HOME_BUTTON))
	{
		handleHomeButton(runtime);
		preventPointerDefault(e);
		return;
	}

	if (pickNamedObjectAtPointer(runtime, e, CONFIG.UI.START_BUTTON))
	{
		handleStartButton(runtime);
		preventPointerDefault(e);
		return;
	}

	// --------------------------------------------------------
	// EZGINI_DINLE GÖRÜNÜRKEN SESLER VE DRAG & DROP PASİF
	// --------------------------------------------------------
	if (isListenLayerVisible(runtime))
	{
		preventPointerDefault(e);
		return;
	}

	// --------------------------------------------------------
	// SESLER FAMILY'SİNE TIKLAMA KONTROLÜ
	// --------------------------------------------------------
	// Yalnızca ezgini_dinle katmanı görünür değilken çalışır.
	// sesler familyasındaki bir Sprite'a doğrudan tıklanırsa
	// o Sprite frame 0'a geçer ve kısa bir animasyon oynatır.
	const clickedTarget = pickTargetAtPointer(runtime, e);

	if (clickedTarget)
	{
		onTargetClicked(clickedTarget);
		preventPointerDefault(e);
		return;
	}

	// --------------------------------------------------------
	// TIKLANACAKLAR DRAG BAŞLANGICI
	// --------------------------------------------------------
	const inst = pickDraggable(runtime, e);

	if (!inst)
		return;

	const [px, py] = getWorldPoint(runtime, inst, e);

	// Sprite'ın ilk konumunu sakla.
	const startX = inst.x;
	const startY = inst.y;

	state.drag = {
		instance: inst,
		pointerId: e.pointerId,
		startX,
		startY,
		offsetX: inst.x - px,
		offsetY: inst.y - py,
		startWidth: inst.width,
		startHeight: inst.height,
		startAngle: inst.angle,
		startZ: inst.z,
		startedAt: performance.now(),
		lastTarget: null
	};

	preventPointerDefault(e);

	// Sprite'ı en üste getir.
	inst.moveToTop?.();

	// Sürükleme başlangıç efekti.
	animateDragStart(inst);
}


// ============================================================
// ARAYÜZ / LAYER / LAYOUT YARDIMCILARI
// ============================================================

function preventPointerDefault(e)
{
	try
	{
		e.preventDefault?.();
	}
	catch (_) {}
}


function getObjectInstancesByName(runtime, objectName)
{
	const objectType = runtime.objects?.[objectName];

	if (!objectType)
		return [];

	try
	{
		return objectType.getAllInstances?.() ?? [];
	}
	catch (_)
	{
		return [];
	}
}


function pickNamedObjectAtPointer(runtime, e, objectName)
{
	const instances = getObjectInstancesByName(runtime, objectName);

	for (let i = instances.length - 1; i >= 0; i--)
	{
		const inst = instances[i];

		if (
			!inst ||
			inst.isDestroyed ||
			inst.isVisible === false ||
			inst.layer?.isVisible === false ||
			typeof inst.containsPoint !== "function"
		)
		{
			continue;
		}

		let x = e.clientX;
		let y = e.clientY;

		if (inst.layer?.cssPxToLayer)
		{
			[x, y] = inst.layer.cssPxToLayer(
				e.clientX,
				e.clientY,
				inst.z ?? 0
			);
		}

		if (inst.containsPoint(x, y))
			return inst;
	}

	return null;
}


function pickAnyNamedObjectAtPointer(runtime, e, objectNames)
{
	if (!Array.isArray(objectNames))
		return null;

	for (const objectName of objectNames)
	{
		const inst = pickNamedObjectAtPointer(runtime, e, objectName);

		if (inst)
			return inst;
	}

	return null;
}


function normalizeObjectName(value)
{
	return String(value ?? "")
		.trim()
		.toLocaleLowerCase("tr-TR")
		.replace(/[^a-z0-9çğıöşü]/g, "");
}


// Ezgi Sprite'ını yalnızca runtime.objects.ezgi anahtarına bağlı kalmadan bulur.
// Böylece nesne adı büyük/küçük harf farklı olsa veya "ezgi" animasyon adı
// olarak kullanılsa bile tıklama DINLE işlevine ulaşır.
function pickMelodyAtPointer(runtime, e)
{
	const wantedNames = new Set(
		(CONFIG.UI.MELODY_BUTTONS ?? ["ezgi"])
			.map(normalizeObjectName)
	);

	for (const [objectKey, objectType] of Object.entries(runtime.objects ?? {}))
	{
		let instances = [];

		try
		{
			instances = objectType?.getAllInstances?.() ?? [];
		}
		catch (_)
		{
			continue;
		}

		for (let i = instances.length - 1; i >= 0; i--)
		{
			const inst = instances[i];

			if (!inst)
				continue;

			const names = [
				objectKey,
				objectType?.name,
				inst?.objectType?.name,
				inst?.animationName
			].map(normalizeObjectName);

			if (!names.some(name => wantedNames.has(name)))
				continue;

			if (
				inst.isDestroyed ||
				inst.isVisible === false ||
				inst.layer?.isVisible === false ||
				typeof inst.containsPoint !== "function"
			)
			{
				continue;
			}

			let x = e.clientX;
			let y = e.clientY;

			if (inst.layer?.cssPxToLayer)
			{
				[x, y] = inst.layer.cssPxToLayer(
					e.clientX,
					e.clientY,
					inst.z ?? 0
				);
			}

			if (inst.containsPoint(x, y))
				return inst;
		}
	}

	return null;
}


function getLayerByName(runtime, layerName)
{
	try
	{
		return runtime.layout?.getLayer?.(layerName) ?? null;
	}
	catch (_)
	{
		return null;
	}
}


function setLayerVisible(runtime, layerName, visible)
{
	const layer = getLayerByName(runtime, layerName);

	if (!layer)
	{
		console.warn(
			`[motiften_sarkiya] Layer bulunamadı: ${layerName}`
		);
		return false;
	}

	layer.isVisible = visible;
	return true;
}


function isListenLayerVisible(runtime)
{
	const layer = getLayerByName(
		runtime,
		CONFIG.UI.LISTEN_LAYER
	);

	return layer?.isVisible === true;
}


function handleForwardButton(runtime)
{
	stopSoundSequence();

	// Olası aktif drag durumunu güvenli biçimde sonlandır.
	if (state.drag)
	{
		returnToStart(state.drag, false);
		state.drag = null;
	}

	setLayerVisible(
		runtime,
		CONFIG.UI.MOTIFS_LAYER,
		false
	);

	setLayerVisible(
		runtime,
		CONFIG.UI.LISTEN_LAYER,
		true
	);

	// Layer görünür olduktan sonra son yönergeyi etkileyici biçimde göster.
	animateFinalInstruction(runtime);
}


function handleHomeButton(runtime)
{
	stopSoundSequence();
	state.drag = null;
	state.fx = [];
	goToNamedLayout(runtime, CONFIG.UI.INTRO_LAYOUT);
}


function handleStartButton(runtime)
{
	stopSoundSequence();
	state.drag = null;
	state.fx = [];
	goToNamedLayout(runtime, CONFIG.UI.GAME_LAYOUT);
}


function goToNamedLayout(runtime, layoutName)
{
	try
	{
		runtime.goToLayout(layoutName);
	}
	catch (error)
	{
		console.error(
			`[motiften_sarkiya] Layout açılamadı: ${layoutName}`,
			error
		);
	}
}


function startStartButtonHint(runtime, layout = null)
{
	const targetLayout = layout ?? runtime.layout;
	const instances = getObjectInstancesByName(
		runtime,
		CONFIG.UI.START_BUTTON
	);

	// Eski efekti varsa temizle; layout tekrar açıldığında yeniden başlatılır.
	state.fx = state.fx.filter(fx => fx.type !== "startButtonHint");

	for (const inst of instances)
	{
		if (!inst || inst.isDestroyed || inst.isVisible === false)
			continue;

		// Yalnızca mevcut layout üzerindeki basla nesnesini hedefle.
		if (targetLayout && inst.layout && inst.layout !== targetLayout)
			continue;

		state.fx.push({
			type: "startButtonHint",
			inst,
			baseW: inst.width,
			baseH: inst.height,
			baseAngle: inst.angle,
			baseOpacity: inst.opacity,
			elapsed: 0,
			duration: CONFIG.UI.START_HINT_DURATION,
			pause: CONFIG.UI.START_HINT_PAUSE
		});
	}
}


function stopStartButtonHint()
{
	state.fx = state.fx.filter(fx => fx.type !== "startButtonHint");
}


function animateFinalInstruction(runtime)
{
	const instances = getObjectInstancesByName(
		runtime,
		CONFIG.UI.FINAL_INSTRUCTION
	);

	for (const inst of instances)
	{
		if (!inst || inst.isDestroyed)
			continue;

		// Aynı nesne için eski animasyonu temizle.
		state.fx = state.fx.filter(fx =>
			!(fx.inst === inst && fx.type === "finalInstruction")
		);

		const finalW = inst.width;
		const finalH = inst.height;
		const finalAngle = inst.angle;

		inst.isVisible = true;
		inst.opacity = 0;
		inst.width = finalW * 0.72;
		inst.height = finalH * 0.72;
		inst.angle = finalAngle - 0.08;

		state.fx.push({
			type: "finalInstruction",
			inst,
			fromW: finalW,
			fromH: finalH,
			fromAngle: finalAngle,
			elapsed: 0,
			duration: 0.75
		});
	}
}


// ============================================================
// DINLE OPACITY 50 -> TIKLANACAKLAR HAFİF TİTREME
// ============================================================

function startDraggableShake(runtime)
{
	const instances = getDragInstances(runtime)
		.filter(inst => inst && !inst.isDestroyed && inst.isVisible !== false);

	if (!instances.length) return;

	state.audioSequence.shakeToken++;
	const token = state.audioSequence.shakeToken;

	state.fx = state.fx.filter(fx => fx.type !== "draggableShake");

	for (const inst of instances)
	{
		state.fx.push({
			type: "draggableShake",
			inst,
			baseX: inst.x,
			baseY: inst.y,
			baseAngle: inst.angle,
			elapsed: 0,
			duration: 0.55,
			token
		});
	}
}

function stopDraggableShake()
{
	state.audioSequence.shakeToken++;
	state.fx = state.fx.filter(fx => fx.type !== "draggableShake");
}

// ============================================================
// DINLE / SOUNDS'LARI DUR - SIRALI SES OYNATMA
// ============================================================

async function playSingleWebm(runtime, fileName)
{
	// Önce varsa devam eden sıralı oynatmayı durdur.
	stopSoundSequence();

	try
	{
		const ready = await tryResumeAudioContext(runtime);

		if (!ready)
		{
			console.error(
				`[motiften_sarkiya] ${fileName} için AudioContext running değil.`
			);
			return;
		}

		const seq = state.audioSequence;
		seq.playing = true;
		seq.token++;
		const token = seq.token;

		await playOneWebm(runtime, fileName, token);

		if (seq.token === token)
			seq.playing = false;
	}
	catch (error)
	{
		state.audioSequence.playing = false;
		console.warn(
			`[motiften_sarkiya] ${fileName} çalınamadı:`,
			error
		);
	}
}


async function startSoundSequence(runtime)
{
	const seq = state.audioSequence;

	// Dinle'ye tekrar basılırsa eski sırayı kesip soldan yeniden başlat.
	stopSoundSequence();

	seq.playing = true;
	seq.token++;

	const token = seq.token;

	console.info(
		"[motiften_sarkiya] DINLE tıklandı. Ses sırası başlatılıyor."
	);

	// Bu çağrı doğrudan kullanıcı tıklamasından gelir; browser ses kilidini burada aç.
	const ready = await tryResumeAudioContext(runtime);

	if (!seq.playing || seq.token !== token)
		return;

	if (!ready)
	{
		console.error(
			"[motiften_sarkiya] Ses sistemi başlatılamadı: AudioContext running değil."
		);
		return;
	}

	playSoundSequencePass(runtime, token);
}


function stopSoundSequence()
{
	stopDraggableShake();
	const seq = state.audioSequence;

	seq.playing = false;
	seq.token++;

	if (seq.retryTimer !== null)
	{
		clearTimeout(seq.retryTimer);
		seq.retryTimer = null;
	}

	if (seq.currentSource)
	{
		try
		{
			seq.currentSource.onended = null;
			seq.currentSource.stop();
		}
		catch (_) {}

		try
		{
			seq.currentSource.disconnect();
		}
		catch (_) {}

		seq.currentSource = null;
	}

	console.info(
		"[motiften_sarkiya] Ses sırası durduruldu."
	);
}


async function tryResumeAudioContext(runtime)
{
	const audioObject = getAudioObject(runtime);
	const audioContext = audioObject?.audioContext;

	if (!audioContext)
	{
		console.error(
			"[motiften_sarkiya] Audio object/audioContext bulunamadı. Construct projesine Audio object ekleyin ve Use worker kapalı olsun."
		);
		return false;
	}

	try
	{
		// Construct Audio nesnesi sessize alınmışsa aç.
		if ("isSilent" in audioObject)
			audioObject.isSilent = false;

		if ("masterVolume" in audioObject && audioObject.masterVolume <= 0)
			audioObject.masterVolume = 1;

		if (audioContext.state === "suspended")
			await audioContext.resume();

		console.info(
			`[motiften_sarkiya] AudioContext state: ${audioContext.state}`
		);

		return audioContext.state === "running";
	}
	catch (error)
	{
		console.error(
			"[motiften_sarkiya] AudioContext devam ettirilemedi:",
			error
		);
		return false;
	}
}


function getAudioObject(runtime)
{
	const direct = runtime.objects?.Audio ?? runtime.objects?.audio ?? null;

	if (direct?.audioContext && direct?.destinationNode)
		return direct;

	// Audio nesnesi projede yeniden adlandırılmışsa da bulmayı dene.
	try
	{
		for (const objectType of Object.values(runtime.objects ?? {}))
		{
			if (objectType?.audioContext && objectType?.destinationNode)
				return objectType;
		}
	}
	catch (_) {}

	return direct;
}


async function playSoundSequencePass(runtime, token)
{
	const seq = state.audioSequence;

	if (!seq.playing || seq.token !== token)
		return;

	// Her tur başında x sırasını yeniden hesapla.
	// Böylece sprite'lar taşınırsa yeni sıra da dikkate alınır.
	const targets = getTargetInstances(runtime)
		.filter(inst => inst && !inst.isDestroyed && inst.isVisible !== false)
		.slice()
		.sort((a, b) => a.x - b.x);

	if (!targets.length)
	{
		scheduleSequenceRetry(runtime, token);
		return;
	}

	// Bütün ses hedefleri frame 0 ise çalınacak hiçbir şey yoktur.
	// Bu kontrol olmazsa sıra hiçbir ses beklemeden tamamlanır ve
	// queueMicrotask ile sonsuz hızda yeniden başlar. Sonuç olarak
	// tarayıcının ana iş parçacığı kilitlenir ve uygulama tıklanamaz olur.
	const hasPlayableTarget = targets.some(target =>
	{
		const frame = Number(target?.animationFrame);
		return Number.isFinite(frame) && frame > 0;
	});

	if (!hasPlayableTarget)
	{
		seq.playing = false;
		console.info(
			"[motiften_sarkiya] Bütün sesler frame 0: çalınacak motif yok, sıra güvenle durduruldu."
		);
		return;
	}

	await playNextTargetInSequence(runtime, targets, 0, token);
}


async function playNextTargetInSequence(runtime, targets, index, token)
{
	const seq = state.audioSequence;

	if (!seq.playing || seq.token !== token)
		return;

	// Bir turun sonuna gelindi: güncel x/frame değerleriyle yeni tur başlat.
	if (index >= targets.length)
	{
		queueMicrotask(() =>
		{
			if (seq.playing && seq.token === token)
				playSoundSequencePass(runtime, token);
		});
		return;
	}

	const target = targets[index];

	if (!target || target.isDestroyed)
	{
		await playNextTargetInSequence(runtime, targets, index + 1, token);
		return;
	}

	// ÖNEMLİ: frame numarasını tam sıra bu sprite'a geldiğinde oku.
	// Böylece frame sonradan değiştirilmişse yeni ses çalar.
	const frame = Number(target.animationFrame);

	// Frame 0 boş/sessiz kabul edilir. Frame 1 -> 1.webm, vb.
	if (!Number.isFinite(frame) || frame <= 0)
	{
		await playNextTargetInSequence(runtime, targets, index + 1, token);
		return;
	}

	const fileName = getSoundFileNameForFrame(frame);

	if (!fileName)
	{
		console.warn(
			`[motiften_sarkiya] Frame ${frame} için ses adı bulunamadı.`
		);
		await playNextTargetInSequence(runtime, targets, index + 1, token);
		return;
	}

	try
	{
		await playOneWebm(runtime, fileName, token);
	}
	catch (error)
	{
		console.warn(
			`[motiften_sarkiya] ${fileName} çalınamadı:`,
			error
		);
	}

	if (!seq.playing || seq.token !== token)
		return;

	await playNextTargetInSequence(runtime, targets, index + 1, token);
}


function getSoundFileNameForFrame(frame)
{
	// Ses dosyalarının adı doğrudan frame numarasıdır:
	// frame 1 -> "1.webm", frame 2 -> "2.webm", ...
	const frameNumber = Math.trunc(Number(frame));

	if (!Number.isFinite(frameNumber) || frameNumber <= 0)
		return null;

	return `${frameNumber}.webm`;
}


async function playOneWebm(runtime, fileName, token)
{
	const seq = state.audioSequence;
	const audioObject = getAudioObject(runtime);

	if (!audioObject?.audioContext || !audioObject?.destinationNode)
	{
		throw new Error(
			"Construct projesinde Audio nesnesi bulunamadı. Audio object ekleyin ve Use worker ayarını kapatın."
		);
	}

	const audioContext = audioObject.audioContext;

	if (audioContext.state === "suspended")
	{
		try
		{
			await audioContext.resume();
		}
		catch (_) {}
	}

	const buffer = await getDecodedAudioBuffer(runtime, audioContext, fileName);

	if (!seq.playing || seq.token !== token)
		return;

	await new Promise((resolve, reject) =>
	{
		let settled = false;
		const source = audioContext.createBufferSource();

		source.buffer = buffer;
		source.connect(audioObject.destinationNode);
		seq.currentSource = source;

		const finish = () =>
		{
			if (settled)
				return;

			settled = true;

			if (seq.currentSource === source)
				seq.currentSource = null;

			try
			{
				source.disconnect();
			}
			catch (_) {}

			resolve();
		};

		source.onended = finish;

		try
		{
			source.start();
		}
		catch (error)
		{
			if (seq.currentSource === source)
				seq.currentSource = null;
			reject(error);
		}
	});
}


async function resolveMediaFileUrl(runtime, fileName)
{
	const assets = runtime.assets;
	const wanted = String(fileName).toLowerCase();
	let matchedName = fileName;

	// Construct proje listesinden gerçek media adını bul.
	try
	{
		const list = assets?.projectFileList ?? [];
		const names = list
			.map(item => typeof item === "string" ? item : item?.name)
			.filter(Boolean);

		const match = names.find(name =>
		{
			const n = String(name).toLowerCase();
			return n === wanted || n.endsWith(`/` + wanted);
		});

		if (match)
			matchedName = match;
		else
		{
			const webmNames = names.filter(name =>
				String(name).toLowerCase().endsWith(".webm")
			);

			console.warn(
				`[motiften_sarkiya] Proje dosya listesinde ${fileName} bulunamadı. WEBM dosyaları:`,
				webmNames
			);
		}
	}
	catch (error)
	{
		console.warn(
			"[motiften_sarkiya] projectFileList okunamadı:",
			error
		);
	}

	// Sounds/Music dosyaları için doğru API budur.
	const url = await assets.getMediaFileUrl(matchedName);

	console.info(
		`[motiften_sarkiya] Media çözüldü: ${fileName} -> ${matchedName} -> ${url}`
	);

	return url;
}


async function getDecodedAudioBuffer(runtime, audioContext, fileName)
{
	const cache = state.audioSequence.bufferCache;

	if (cache.has(fileName))
		return cache.get(fileName);

	const promise = (async () =>
	{
		const mediaUrl = await resolveMediaFileUrl(runtime, fileName);

		let response;

		try
		{
			response = await fetch(mediaUrl);
		}
		catch (error)
		{
			throw new Error(
				`${fileName} indirilemedi (${mediaUrl}): ${error?.message ?? error}`
			);
		}

		if (!response.ok)
		{
			throw new Error(
				`${fileName} HTTP ${response.status} ile yüklenemedi: ${mediaUrl}`
			);
		}

		const arrayBuffer = await response.arrayBuffer();

		if (!arrayBuffer.byteLength)
			throw new Error(`${fileName} boş bir dosya olarak yüklendi.`);

		let decoded;

		try
		{
			decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
		}
		catch (error)
		{
			throw new Error(
				`${fileName} decode edilemedi: ${error?.message ?? error}`
			);
		}

		console.info(
			`[motiften_sarkiya] Ses hazır: ${fileName} (${decoded.duration.toFixed(2)} sn)`
		);

		return decoded;
	})();

	cache.set(fileName, promise);

	try
	{
		return await promise;
	}
	catch (error)
	{
		cache.delete(fileName);
		throw error;
	}
}


function scheduleSequenceRetry(runtime, token)
{
	const seq = state.audioSequence;

	if (!seq.playing || seq.token !== token)
		return;

	if (seq.retryTimer !== null)
		clearTimeout(seq.retryTimer);

	seq.retryTimer = setTimeout(() =>
	{
		seq.retryTimer = null;

		if (seq.playing && seq.token === token)
			playSoundSequencePass(runtime, token);
	}, 250);
}


// ============================================================
// SESLER FAMILY'SİNDEN TIKLANAN SPRITE'I BUL
// ============================================================

function pickTargetAtPointer(runtime, e)
{
	const targets = getTargetInstances(runtime);

	// Üstteki hedef önce kontrol edilir.
	for (let i = targets.length - 1; i >= 0; i--)
	{
		const target = targets[i];

		if (
			!target ||
			target.isDestroyed ||
			target.isVisible === false ||
			typeof target.containsPoint !== "function"
		)
		{
			continue;
		}

		let x = e.clientX;
		let y = e.clientY;

		// Her hedefi kendi layer koordinatında test et.
		if (target.layer?.cssPxToLayer)
		{
			[x, y] = target.layer.cssPxToLayer(
				e.clientX,
				e.clientY,
				target.z ?? 0
			);
		}

		if (target.containsPoint(x, y))
			return target;
	}

	return null;
}


// ============================================================
// SESLER SPRITE'INA TIKLANDIĞINDA FRAME 0 + ANİMASYON
// ============================================================

function onTargetClicked(target)
{
	if (
		!target ||
		target.isDestroyed ||
		!isSpriteLike(target)
	)
	{
		return;
	}

	// İstenen davranış: tıklanan sesler Sprite'ı frame 0 olsun.
	target.animationFrame = 0;

	animateTargetClick(target);
}


function animateTargetClick(target)
{
	if (!target || target.isDestroyed)
		return;

	// Aynı Sprite için üst üste click/frame-change efekti birikmesin.
	state.fx = state.fx.filter(fx =>
		!(fx.inst === target && (
			fx.type === "targetClick" ||
			fx.type === "frameChange"
		))
	);

	state.fx.push({
		type: "targetClick",
		inst: target,
		fromW: target.width,
		fromH: target.height,
		fromAngle: target.angle,
		elapsed: 0,
		duration: 0.22
	});
}


// ============================================================
// POINTER MOVE
// ============================================================

function onPointerMove(runtime, e)
{
	const d = state.drag;

	if (!d || e.pointerId !== d.pointerId)
		return;

	// ezgini_dinle açıldıysa drag davranışını anında kapat.
	if (isListenLayerVisible(runtime))
	{
		returnToStart(d, false);
		state.drag = null;
		preventPointerDefault(e);
		return;
	}

	const inst = d.instance;

	if (!inst || inst.isDestroyed)
	{
		state.drag = null;
		return;
	}

	const [px, py] = getWorldPoint(runtime, inst, e);

	inst.setPosition(
		px + d.offsetX,
		py + d.offsetY
	);

	inst.angle =
		d.startAngle +
		CONFIG.DRAG_ROTATION;

	const target = findTargetUnderPoint(
		runtime,
		inst.x,
		inst.y
	);

	if (target !== d.lastTarget)
	{
		if (d.lastTarget)
			animateTargetOut(d.lastTarget);

		if (target)
			animateTargetIn(target);

		d.lastTarget = target;
	}

	preventPointerDefault(e);
}


// ============================================================
// POINTER UP
// ============================================================

function onPointerUp(runtime, e)
{
	const d = state.drag;

	if (!d || e.pointerId !== d.pointerId)
		return;

	if (isListenLayerVisible(runtime))
	{
		returnToStart(d, false);
		state.drag = null;
		preventPointerDefault(e);
		return;
	}

	finishDrag(runtime, d);
	preventPointerDefault(e);
}


// ============================================================
// POINTER CANCEL
// ============================================================

function onPointerCancel(runtime, e)
{
	const d = state.drag;

	if (!d || e.pointerId !== d.pointerId)
		return;

	returnToStart(d, false);
	state.drag = null;
	preventPointerDefault(e);
}


// ============================================================
// SÜRÜKLEMEYİ BİTİR
// ============================================================

function finishDrag(runtime, d)
{
	const inst = d.instance;

	if (!inst || inst.isDestroyed)
	{
		state.drag = null;
		return;
	}

	// Bırakılan yerde hedef var mı?
	const target = findTargetUnderPoint(
		runtime,
		inst.x,
		inst.y,
		inst
	);

	if (target)
	{
		// Özel kural: alkis sprite'ı ses1 sprite'ına değdiğinde
		// Array nesnesinin ilk elemanına 1 yaz.
		if (
			getDraggableSpriteName(inst) === "alkis" &&
			getTargetSpriteName(target) === "ses1"
		)
		{
			setArrayFirstElementToOne(runtime);
		}

		// Sprite adına göre sesler frame'ini değiştir.
		const matched = applyMatch(inst, target);

		if (matched)
		{
			// Başarılı bırakılan tiklanacaklar sprite'ı görünmez olur,
			// eski konumuna döner ve dönüş tamamlanınca tekrar görünür.
			inst.opacity = 0;
			returnToStart(d, true);
		}
		else
		{
			returnToStart(d, false);
		}
	}
	else
	{
		// Hedef yoksa eski konuma dön.
		returnToStart(d, false);
	}

	if (
		d.lastTarget &&
		d.lastTarget !== target
	)
	{
		animateTargetOut(d.lastTarget);
	}

	state.drag = null;
}


// ============================================================
// SESLER FAMILY İÇİNDE HEDEF BUL
// ============================================================

function findTargetUnderPoint(
	runtime,
	x,
	y,
	source = null
)
{
	const targets = getTargetInstances(runtime);

	for (let i = targets.length - 1; i >= 0; i--)
	{
		const target = targets[i];

		if (!target || target.isDestroyed || target.isVisible === false)
			continue;

		// Önce gerçek dikdörtgen çakışmasını kontrol et.
		if (source && areInstancesOverlapping(source, target))
			return target;

		// API desteklemeyen durumlarda merkez noktasını kullan.
		if (typeof target.containsPoint === "function" && target.containsPoint(x, y))
			return target;
	}

	return null;
}


// ============================================================
// SPRITE'LARIN BİRBİRİNE DEĞİP DEĞMEDİĞİNİ KONTROL ET
// ============================================================

function areInstancesOverlapping(source, target)
{
	if (!source || !target)
		return false;

	try
	{
		const a = source.getBoundingBox?.();
		const b = target.getBoundingBox?.();

		if (a && b)
		{
			return !(
				b.left > a.right ||
				b.right < a.left ||
				b.top > a.bottom ||
				b.bottom < a.top
			);
		}
	}
	catch (_) {}

	return (
		typeof target.containsPoint === "function" &&
		target.containsPoint(source.x, source.y)
	);
}


// ============================================================
// FRAME EŞLEŞTİRME
// ============================================================

function setArrayFirstElementToOne(runtime)
{
	try
	{
		const arrayObject = runtime.objects?.[CONFIG.UI.ARRAY_OBJECT];

		if (!arrayObject)
		{
			console.warn(
				`[motiften_sarkiya] Array nesnesi bulunamadı: ${CONFIG.UI.ARRAY_OBJECT}`
			);
			return false;
		}

		const instances = arrayObject.getAllInstances?.() ?? [];

		if (!instances.length)
		{
			console.warn(
				`[motiften_sarkiya] Array nesnesinin instance'ı bulunamadı: ${CONFIG.UI.ARRAY_OBJECT}`
			);
			return false;
		}

		const arrayInstance = instances[0];

		// Construct 3 Array indeksleri 0'dan başlar.
		// Bu nedenle 1. eleman = X:0, Y:0, Z:0 hücresine 1 yazılır.
		if (typeof arrayInstance.setAt === "function")
		{
			arrayInstance.setAt(0, 0, 0, 1);
			console.info(
				"[motiften_sarkiya] array[0,0,0] = 1 yapıldı."
			);
			return true;
		}

		console.warn(
			"[motiften_sarkiya] Array nesnesinde setAt fonksiyonu bulunamadı."
		);
		return false;
	}
	catch (error)
	{
		console.error(
			"[motiften_sarkiya] Array değerine 1 yazılamadı:",
			error
		);
		return false;
	}
}


function applyMatch(source, target)
{
	if (!source || !target || target.isDestroyed)
		return false;

	const sourceName = getDraggableSpriteName(source);
	const targetFrame = CONFIG.FRAME_MAP[sourceName];

	if (targetFrame === undefined)
	{
		console.warn(
			"[motiften_sarkiya] FRAME_MAP içinde eşleşme yok:",
			sourceName
		);
		return false;
	}

	if (!isSpriteLike(target))
	{
		console.warn("[motiften_sarkiya] Hedef Sprite animation özelliğine sahip değil.");
		return false;
	}

	const animation = target.animation;
	const frameCount = animation?.frameCount ?? 0;

	if (frameCount <= targetFrame)
	{
		console.warn(
			`[motiften_sarkiya] Hedef animasyonda frame ${targetFrame} yok. Frame sayısı: ${frameCount}.`,
			target
		);
		return false;
	}

	// Construct 3 runtime frame numarası doğrudan kullanılır.
	target.animationFrame = targetFrame;

	// Bazı projelerde animationFrame ataması aynı tick içinde görsel olarak
	// fark edilmeyebilir; tekrar doğrula ve gerekiyorsa bir kez daha uygula.
	if (target.animationFrame !== targetFrame)
		target.animationFrame = targetFrame;

	console.info(
		`[motiften_sarkiya] ${sourceName} -> sesler frame ${targetFrame}`
	);

	animateFrameChange(target);
	return true;
}


// ============================================================
// TIKLANACAKLAR SPRITE ADINI AL
// ============================================================

function getTargetSpriteName(inst)
{
	const rawName =
		inst?.objectType?.name ??
		inst?.objectType?.plugin?.name ??
		"";

	return String(rawName)
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "_")
		.replace(/-/g, "_");
}


function getDraggableSpriteName(inst)
{
	const rawName =
		inst?.objectType?.name ??
		inst?.objectType?.plugin?.name ??
		"";

	return String(rawName)
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "_")
		.replace(/-/g, "_");
}


// ============================================================
// FRAME DEĞİŞİM EFEKTİ
// ============================================================

function animateFrameChange(target)
{
	if (!target || target.isDestroyed)
		return;

	state.fx.push({
		type: "frameChange",
		inst: target,
		fromW: target.width,
		fromH: target.height,
		fromAngle: target.angle,
		elapsed: 0,
		duration: 0.16
	});
}


// ============================================================
// SPRITE KONTROLÜ
// ============================================================

function isSpriteLike(inst)
{
	return (
		!!inst &&
		typeof inst.animationFrame === "number" &&
		!!inst.animation
	);
}


// ============================================================
// YANLIŞ YERE BIRAKILINCA GERİ DÖN
// ============================================================

function returnToStart(d, hideWhileReturning = false)
{
	const inst = d.instance;


	if (
		!inst ||
		inst.isDestroyed
	)
	{
		return;
	}


	state.fx.push({

		type: "return",

		inst,

		fromX:
			inst.x,

		fromY:
			inst.y,

		fromAngle:
			inst.angle,

		fromW:
			inst.width,

		fromH:
			inst.height,

		toX:
			d.startX,

		toY:
			d.startY,

		toAngle:
			d.startAngle,

		toW:
			d.startWidth,

		toH:
			d.startHeight,

		elapsed: 0,

		duration:
			CONFIG.RETURN_TIME,

		hideWhileReturning
	});
}


// ============================================================
// SÜRÜKLEME BAŞLANGIÇ ANİMASYONU
// ============================================================

function animateDragStart(inst)
{
	state.fx.push({

		type: "drag",

		inst,

		fromW:
			inst.width,

		fromH:
			inst.height,

		toW:
			inst.width *
			CONFIG.DRAG_SCALE,

		toH:
			inst.height *
			CONFIG.DRAG_SCALE,

		elapsed: 0,

		duration: 0.10
	});
}


// ============================================================
// HEDEF ÜZERİNE GELİNCE
// ============================================================

function animateTargetIn(target)
{
	if (
		!target ||
		target.isDestroyed
	)
	{
		return;
	}


	state.fx.push({

		type: "targetIn",

		inst: target,

		fromW:
			target.width,

		fromH:
			target.height,

		toW:
			target.width * 1.05,

		toH:
			target.height * 1.05,

		elapsed: 0,

		duration: 0.10
	});
}


// ============================================================
// HEDEFTEN AYRILINCA
// ============================================================

function animateTargetOut(target)
{
	if (
		!target ||
		target.isDestroyed
	)
	{
		return;
	}


	state.fx.push({

		type: "targetOut",

		inst: target,

		fromW:
			target.width,

		fromH:
			target.height,

		toW:
			target.width / 1.05,

		toH:
			target.height / 1.05,

		elapsed: 0,

		duration: 0.10
	});
}


// ============================================================
// BAŞARILI EŞLEŞME ANİMASYONU
// ============================================================

function animateSuccess(
	inst,
	target
)
{
	if (
		!inst ||
		inst.isDestroyed
	)
	{
		return;
	}


	state.fx.push({

		type: "success",

		inst,

		fromW:
			inst.width,

		fromH:
			inst.height,

		toW:
			inst.width,

		toH:
			inst.height,

		elapsed: 0,

		duration:
			CONFIG.SUCCESS_TIME,

		startAngle:
			inst.angle,

		targetX:
			target.x,

		targetY:
			target.y
	});
}


// ============================================================
// EASE
// ============================================================

function ease(t)
{
	return (
		1 -
		Math.pow(
			1 -
			Math.max(
				0,
				Math.min(
					1,
					t
				)
			),
			CONFIG.EASE_POWER
		)
	);
}


// ============================================================
// HER FRAME ÇALIŞAN ANİMASYON SİSTEMİ
// ============================================================

function Tick(runtime)
{
	const dt =
		runtime.dt ||
		(1 / 60);


	for (
		let i = state.fx.length - 1;
		i >= 0;
		i--
	)
	{
		const fx =
			state.fx[i];


		const inst =
			fx.inst;


		if (
			!inst ||
			inst.isDestroyed
		)
		{
			state.fx.splice(i, 1);
			continue;
		}


		fx.elapsed += dt;


		const t =
			Math.min(
				1,
				fx.elapsed /
				fx.duration
			);


		const p =
			ease(t);


		// ----------------------------------------------------
		// GERİ DÖNÜŞ
		// ----------------------------------------------------

		if (fx.type === "return")
		{
			if (fx.hideWhileReturning)
				inst.opacity = 0;

			inst.setPosition(

				lerp(
					fx.fromX,
					fx.toX,
					p
				),

				lerp(
					fx.fromY,
					fx.toY,
					p
				)
			);


			inst.angle =
				lerp(
					fx.fromAngle,
					fx.toAngle,
					p
				);


			inst.width =
				lerp(
					fx.fromW,
					fx.toW,
					p
				);


			inst.height =
				lerp(
					fx.fromH,
					fx.toH,
					p
				);
		}


		// ----------------------------------------------------
		// DRAG / TARGET ANİMASYONLARI
		// ----------------------------------------------------

		else if (
			fx.type === "drag" ||
			fx.type === "targetIn" ||
			fx.type === "targetOut"
		)
		{
			inst.width =
				lerp(
					fx.fromW,
					fx.toW,
					p
				);


			inst.height =
				lerp(
					fx.fromH,
					fx.toH,
					p
				);
		}


		// ----------------------------------------------------
		// SESLER TIKLAMA / FRAME 0 EFEKTİ
		// ----------------------------------------------------

		else if (fx.type === "targetClick")
		{
			const pulse = Math.sin(t * Math.PI);
			inst.width = fx.fromW * (1 + 0.11 * pulse);
			inst.height = fx.fromH * (1 + 0.11 * pulse);
			inst.angle = fx.fromAngle + 0.04 * Math.sin(t * Math.PI * 2);
		}


		// ----------------------------------------------------
		// SON YÖNERGE GİRİŞ ANİMASYONU
		// ----------------------------------------------------

		else if (fx.type === "finalInstruction")
		{
			// Fade + elastic pop + hafif salınım.
			const fade = Math.min(1, t * 2.4);
			const baseScale = 0.72 + 0.28 * p;
			const overshoot = 0.16 * Math.sin(t * Math.PI) * (1 - t * 0.35);
			const scale = baseScale + overshoot;

			inst.opacity = fade;
			inst.width = fx.fromW * scale;
			inst.height = fx.fromH * scale;
			inst.angle =
				fx.fromAngle -
				0.08 * (1 - p) +
				0.035 * Math.sin(t * Math.PI * 4) * (1 - t);
		}


		// ----------------------------------------------------
		// FRAME DEĞİŞİM EFEKTİ
		// ----------------------------------------------------

		else if (fx.type === "frameChange")
		{
			const bump = Math.sin(t * Math.PI);
			inst.width = fx.fromW * (1 + 0.08 * bump);
			inst.height = fx.fromH * (1 + 0.08 * bump);
			inst.angle = fx.fromAngle + 0.025 * Math.sin(t * Math.PI * 2);
		}


		// ----------------------------------------------------
		// GİRİŞTE "BASLA" BUTONU TIKLANABİLİRLİK EFEKTİ
		// ----------------------------------------------------

		else if (fx.type === "startButtonHint")
		{
			// Pulse -> kısa bekleme -> tekrar pulse.
			// Yumuşak büyüme ve çok hafif salınım, butonu
			// dikkat çekici yapar ama göz yormaz.
			const cycle = fx.duration + fx.pause;
			const timeInCycle = fx.elapsed % cycle;

			if (timeInCycle < fx.duration)
			{
				const localT = timeInCycle / fx.duration;
				const pulse = Math.sin(localT * Math.PI);
				const scale = 1 + (CONFIG.UI.START_HINT_SCALE - 1) * pulse;

				inst.width = fx.baseW * scale;
				inst.height = fx.baseH * scale;

				inst.angle =
					fx.baseAngle +
					CONFIG.UI.START_HINT_ANGLE * Math.sin(localT * Math.PI * 2);

				// Çok hafif parlama hissi; temel opacity korunur.
				inst.opacity =
					Math.min(1, fx.baseOpacity + 0.08 * pulse);
			}
			else
			{
				inst.width = fx.baseW;
				inst.height = fx.baseH;
				inst.angle = fx.baseAngle;
				inst.opacity = fx.baseOpacity;
			}
		}

		// ----------------------------------------------------
		// TIKLANACAKLAR HAFİF TİTREME
		// ----------------------------------------------------

		else if (fx.type === "draggableShake")
		{
			const strength = 2.2 * (1 - t);
			const wave = Math.sin(t * Math.PI * 10);

			inst.setPosition(
				fx.baseX + wave * strength,
				fx.baseY + Math.cos(t * Math.PI * 12) * strength * 0.65
			);

			inst.angle =
				fx.baseAngle + Math.sin(t * Math.PI * 14) * 0.012;
		}

		// ----------------------------------------------------
		// BAŞARILI EŞLEŞME
		// ----------------------------------------------------

		else if (
			fx.type === "success"
		)
		{
			// Küçük bounce efekti.
			const bump =
				Math.sin(
					t * Math.PI
				);


			inst.width =
				fx.fromW *
				(
					1 +
					0.08 * bump
				);


			inst.height =
				fx.fromH *
				(
					1 +
					0.08 * bump
				);


			inst.angle =
				fx.startAngle +
				0.035 *
				Math.sin(
					t *
					Math.PI *
					2
				);
		}


		// ----------------------------------------------------
		// ANİMASYON BİTTİ
		// ----------------------------------------------------

		// Basla efekti tek seferlik değildir. Giriş layout'u açık
		// kaldığı sürece modulo tabanlı pulse döngüsü devam eder.
		// Bu yüzden genel "animasyon bitti" temizliğinde silme.
		if (fx.type === "startButtonHint")
			continue;

		if (t >= 1)
		{
			if (
				fx.type === "drag"
			)
			{
				inst.width =
					fx.toW;

				inst.height =
					fx.toH;
			}


			else if (
				fx.type === "targetIn"
			)
			{
				inst.width =
					fx.toW;

				inst.height =
					fx.toH;
			}


			else if (
				fx.type === "targetOut"
			)
			{
				inst.width =
					fx.toW;

				inst.height =
					fx.toH;
			}


			else if (fx.type === "targetClick")
			{
				inst.width = fx.fromW;
				inst.height = fx.fromH;
				inst.angle = fx.fromAngle;
			}


			else if (fx.type === "finalInstruction")
			{
				inst.opacity = 1;
				inst.width = fx.fromW;
				inst.height = fx.fromH;
				inst.angle = fx.fromAngle;
			}


			else if (fx.type === "frameChange")
			{
				inst.width = fx.fromW;
				inst.height = fx.fromH;
				inst.angle = fx.fromAngle;
			}


			else if (fx.type === "draggableShake")
			{
				inst.setPosition(fx.baseX, fx.baseY);
				inst.angle = fx.baseAngle;
			}

			else if (fx.type === "startButtonHint")
			{
				inst.width = fx.baseW;
				inst.height = fx.baseH;
				inst.angle = fx.baseAngle;
				inst.opacity = fx.baseOpacity;
			}

			else if (
				fx.type === "return"
			)
			{
				inst.setPosition(
					fx.toX,
					fx.toY
				);


				inst.angle =
					fx.toAngle;


				inst.width =
					fx.toW;


				inst.height =
					fx.toH;

				if (fx.hideWhileReturning)
					inst.opacity = 1;
			}


			state.fx.splice(
				i,
				1
			);
		}
	}
}


// ============================================================
// LINEAR INTERPOLATION
// ============================================================

function lerp(a, b, t)
{
	return (
		a +
		(b - a) * t
	);
}
