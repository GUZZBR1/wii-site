import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { CalibrationProfile, SportActionEvent } from './cv/protocol';
import { AutoCalibrator, type CalibrationPhase } from './cv/autoCalibrator';
import { PoseClient, type PoseClientCallbacks } from './cv/poseClient';
import { ActionPipeline } from './kinematics/actionPipeline';
import { ProceduralAudio } from './games/audio';
import { CameraPip } from './ui/CameraPip';
import { GameCanvas, type GameEngineHandle, type Sport } from './ui/GameCanvas';
import { drawPose } from './ui/PoseOverlay';
import { GamesMenu, HomeMenu, TitleMenu } from './ui/WiiMenu';
import { WiiSplash } from './ui/WiiSplash';
import './arena.css';

type Screen = 'calibration' | 'home' | 'title' | 'games' | 'play';

export default function ArenaApp({ exit }: { exit: ReactNode }) {
  const [splash, setSplash] = useState(true);
  const [screen, setScreen] = useState<Screen>('calibration');
  const [sport, setSport] = useState<Sport>('track');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('Permissão da câmera ainda não solicitada');
  const [tracking, setTracking] = useState('SEM POSE');
  const [calibrationPhase, setCalibrationPhase] = useState<CalibrationPhase>('framing');
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const clientRef = useRef<PoseClient | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const engineRef = useRef<GameEngineHandle | null>(null);
  const pipelineRef = useRef(new ActionPipeline());
  const calibratorRef = useRef(new AutoCalibrator());
  const sportRef = useRef(sport);
  sportRef.current = sport;
  const profileRef = useRef<CalibrationProfile | undefined>(undefined);
  const audioRef = useRef(new ProceduralAudio());
  const cameraAttemptRef = useRef(0);

  useEffect(() => {
    void navigator.permissions?.query({ name: 'camera' as PermissionName }).then((permission) => {
      if (permission.state === 'granted') PoseClient.warmVisionAssets();
    }).catch(() => undefined);
    return () => {
      cameraAttemptRef.current += 1;
      clientRef.current?.dispose();
      streamRef.current?.getTracks().forEach((track) => { track.stop(); });
      streamRef.current = undefined;
      audioRef.current.dispose();
    };
  }, []);

  const onEngine = useCallback((engine: GameEngineHandle | null) => { engineRef.current = engine; }, []);
  const dispatchEvent = useCallback((event: SportActionEvent) => {
    if (!engineRef.current) return;
    engineRef.current.onAction(event);
    if (event.type === 'swing') audioRef.current.hit(event.power01);
    if (event.type === 'jump') audioRef.current.jump();
    if (event.type === 'step') audioRef.current.step(event.side);
  }, []);

  const recalibrate = useCallback(() => {
    profileRef.current = undefined;
    calibratorRef.current.reset();
    setCalibrationPhase('framing');
    setCalibrationProgress(0);
  }, []);

  const stopCamera = useCallback(() => {
    cameraAttemptRef.current += 1;
    clientRef.current?.pauseCapture();
    streamRef.current?.getTracks().forEach((track) => { track.stop(); });
    streamRef.current = undefined;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setTracking('SEM POSE');
    setCameraStatus('Câmera desligada');
    for (const event of pipelineRef.current.reset()) dispatchEvent(event);
    recalibrate();
    drawPose(overlayRef.current, videoRef.current);
  }, [dispatchEvent, recalibrate]);

  const startCamera = useCallback(async () => {
    stopCamera();
    const attempt = ++cameraAttemptRef.current;
    const stale = () => cameraAttemptRef.current !== attempt;
    const callbacks: PoseClientCallbacks = {
      onStatus: (status, detail) => {
        if (stale()) return;
        setCameraStatus(detail);
        if (status === 'error') { setTracking('SEM POSE'); stopCamera(); setCameraStatus(detail); }
      },
      onPose: (raw) => {
        if (stale()) return;
        const result = pipelineRef.current.update(raw, profileRef.current);
        const current = result.snapshot;
        setTracking(current.trackingState === 'tracked' ? 'TRACKING' : current.trackingState === 'lost' ? 'SEM POSE' : 'PROCURANDO');
        if (!profileRef.current) {
          const step = calibratorRef.current.update(current, sportRef.current === 'track');
          profileRef.current = step.profile;
          setCalibrationPhase(step.phase);
          setCalibrationProgress(step.progress);
          if (step.profile) {
            setCameraStatus(step.profile.world.leanUp0
              ? 'Calibração aprovada · postura neutra salva'
              : 'Calibração parcial · troca de raia e salto desativados · estenda as pernas e enquadre os tornozelos');
          }
        }
        drawPose(overlayRef.current, videoRef.current, current);
        for (const event of result.events) dispatchEvent(event);
      },
    };
    try {
      void audioRef.current.unlock();
      clientRef.current ??= new PoseClient();
      const client = clientRef.current;
      const visionReady = client.init(callbacks);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } },
      });
      if (stale()) { stream.getTracks().forEach((track) => { track.stop(); }); return; }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('Prévia da câmera não está disponível.');
      video.srcObject = stream;
      await video.play();
      if (stale()) return;
      await new Promise<void>((resolve) => {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) resolve();
        else {
          video.addEventListener('loadeddata', () => resolve(), { once: true });
          video.addEventListener('emptied', () => resolve(), { once: true });
        }
      });
      if (stale()) return;
      setCameraOn(true);
      await visionReady;
      if (stale() || !client.isReady || streamRef.current !== stream) return;
      client.beginCapture(video, callbacks);
    } catch (error) {
      if (stale()) return;
      stopCamera();
      setCameraStatus(error instanceof Error ? error.message : 'Não foi possível iniciar a câmera.');
    }
  }, [stopCamera, dispatchEvent]);

  const toggleMute = useCallback(() => {
    void audioRef.current.unlock();
    setMuted((value) => { audioRef.current.setMuted(!value); return !value; });
  }, []);

  const endSplash = useCallback(() => {
    setSplash(false);
    void startCamera();
  }, [startCamera]);

  // Calibrou: deixa o "Calibrado" aparecer e segue para o menu.
  useEffect(() => {
    if (screen !== 'calibration' || calibrationPhase !== 'done') return;
    const timer = window.setTimeout(() => setScreen('home'), 1500);
    return () => window.clearTimeout(timer);
  }, [screen, calibrationPhase]);

  const skipCalibration = () => {
    stopCamera();
    setScreen('home');
  };

  const play = (next: Sport) => {
    void audioRef.current.unlock();
    setSport(next);
    sportRef.current = next;
    // Um perfil parcial não tem referência de salto/raia: a corrida refaz a calibração.
    if (next === 'track' && profileRef.current && !profileRef.current.world.leanUp0) recalibrate();
    setScreen('play');
  };

  return <div className="stage">
    {screen === 'play' && <GameCanvas key={sport} sport={sport} onEngine={onEngine} tracking={tracking} />}
    {screen === 'calibration' && <section className="wii-screen">
      <h1>Calibração do corpo</h1>
      <p>Permita a câmera, afaste-se até o corpo inteiro aparecer e fique parado.</p>
      <button type="button" className="wii-skip" onClick={skipCalibration}>Pular</button>
    </section>}
    {screen === 'home' && <HomeMenu exit={exit} onGames={() => setScreen('title')} />}
    {screen === 'title' && <TitleMenu onStart={() => setScreen('games')} onBack={() => setScreen('home')} />}
    {screen === 'games' && <GamesMenu onHome={() => setScreen('home')} onPick={play} onBack={() => setScreen('title')} />}

    {screen === 'play' && <div className="hud-dock">
      <button type="button" className="dock-btn" onClick={() => setScreen('games')}>‹ Jogos</button>
      <button type="button" className="dock-btn round" onClick={toggleMute} title={muted ? 'Áudio desligado' : 'Áudio ligado'}>{muted ? '×' : '♫'}</button>
    </div>}

    <CameraPip
      sport={sport}
      videoRef={videoRef} canvasRef={overlayRef} cameraOn={cameraOn} status={cameraStatus} tracking={tracking}
      calibrationPhase={calibrationPhase} calibrationProgress={calibrationProgress}
      onStart={() => void startCamera()} onStop={stopCamera} onRecalibrate={recalibrate}
    />
    {splash && <WiiSplash onDone={endSplash} />}
  </div>;
}
