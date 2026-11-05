import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import { GENERALS } from './game/generals';
import { randomSeed } from './game/rng';
import MainMenu from './ui/MainMenu';
import GeneralSelect from './ui/GeneralSelect';
import HowToPlay from './ui/HowToPlay';
import Hud from './ui/Hud';
import LevelUpModal from './ui/LevelUpModal';
import ResultsScreen from './ui/ResultsScreen';
import WheelPanel from './ui/WheelPanel';
import { wheelFeed } from './squeek/wheel';

const STORAGE_KEY = 'mandate-of-the-wheel';

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

function savePrefs(p) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export default function App() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const prefs = useRef(loadPrefs());

  const [screen, setScreen] = useState('menu'); // menu | select | howto | game
  const [generalId, setGeneralId] = useState(prefs.current.generalId || GENERALS[0].id);
  const [seedInput, setSeedInput] = useState('');
  const [hud, setHud] = useState(null);
  const [banner, setBanner] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const [paused, setPaused] = useState(false);
  const [results, setResults] = useState(null);
  const [highScore, setHighScore] = useState(prefs.current.highScore || 0);
  const bannerTimer = useRef(0);
  const bannerKey = useRef(0);
  const [wheel, setWheel] = useState(wheelFeed.snap);
  const [round, setRound] = useState(() => wheelFeed.round());

  const general = GENERALS.find((g) => g.id === generalId) || GENERALS[0];

  // Squeekchain live feed: one poller for the whole app, pushed into the game as it arrives.
  useEffect(() => {
    wheelFeed.start();
    const off = wheelFeed.subscribe((snap) => {
      setWheel(snap);
      if (gameRef.current) gameRef.current.setWheel(snap);
    });
    const offBlocks = wheelFeed.onBlocks((delta) => {
      if (gameRef.current) gameRef.current.onSqueekBlocks(delta);
    });
    const tick = setInterval(() => setRound(wheelFeed.round()), 1000);
    return () => { off(); offBlocks(); clearInterval(tick); wheelFeed.stop(); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const game = new Game(canvas, {
      onHud: (h) => setHud(h),
      onBanner: (title, sub) => {
        bannerKey.current += 1;
        setBanner({ title, sub, key: bannerKey.current });
        clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setBanner(null), 2300);
      },
      onLevelUp: (cards, level) => setLevelUp(cards ? { cards, level } : null),
      onPause: (isPaused) => setPaused(isPaused),
      onEnd: (r) => {
        setLevelUp(null);
        setPaused(false);
        setResults(r);
        setHighScore((prev) => {
          const next = Math.max(prev, r.score);
          prefs.current = { ...prefs.current, highScore: next };
          savePrefs(prefs.current);
          return next;
        });
      },
    });
    game.roundSource = () => wheelFeed.round();
    game.setWheel(wheelFeed.snap);
    gameRef.current = game;
    if (import.meta.env.DEV) Object.assign(window, { __game: game, __generals: GENERALS });   // playtesting hook, stripped from builds
    return () => {
      clearTimeout(bannerTimer.current);
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const startRun = useCallback(
    (gen, forcedSeed) => {
      const seed = forcedSeed || (seedInput.trim() ? seedInput.trim().toUpperCase() : randomSeed());
      setResults(null);
      setLevelUp(null);
      setPaused(false);
      setBanner(null);
      setHud(null);
      setScreen('game');
      // Let the canvas become visible before the first frame.
      requestAnimationFrame(() => {
        const game = gameRef.current;
        if (!game) return;
        game.renderer.resize();
        game.start(gen, seed);
      });
    },
    [seedInput],
  );

  const selectGeneral = (id) => {
    setGeneralId(id);
    prefs.current = { ...prefs.current, generalId: id };
    savePrefs(prefs.current);
  };

  const quitToMenu = () => {
    const game = gameRef.current;
    if (game) {
      game.state = 'idle';
      game.player = null;
    }
    setResults(null);
    setLevelUp(null);
    setPaused(false);
    setBanner(null);
    setHud(null);
    setScreen('menu');
  };

  const isTouch = gameRef.current ? gameRef.current.input.isTouch : false;
  const inGame = screen === 'game';

  return (
    <div className="app">
      <canvas ref={canvasRef} className={`game-canvas ${inGame ? '' : 'hidden'}`} />

      {screen === 'menu' && (
        <MainMenu
          general={general}
          highScore={highScore}
          wheelPanel={<WheelPanel snap={wheel} round={round} />}
          round={round.round}
          onRoundChallenge={() => startRun(general, `ROUND-${wheelFeed.round().round}`)}
          onPlay={() => startRun(general)}
          onChooseGeneral={() => setScreen('select')}
          onHowToPlay={() => setScreen('howto')}
        />
      )}

      {screen === 'select' && (
        <GeneralSelect
          selectedId={generalId}
          onSelect={selectGeneral}
          seed={seedInput}
          onSeedChange={setSeedInput}
          onStart={() => startRun(general)}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'howto' && <HowToPlay onBack={() => setScreen('menu')} />}

      {inGame && !results && (
        <Hud
          hud={hud}
          isTouch={isTouch}
          onPause={() => gameRef.current && gameRef.current.togglePause()}
          wheelPanel={hud ? <WheelPanel snap={wheel} round={round} battle={hud.wheel} compact /> : null}
        />
      )}

      {inGame && banner && (
        <div className="banner" key={banner.key}>
          <div className="banner-title">{banner.title}</div>
          {banner.sub ? <div className="banner-sub">{banner.sub}</div> : null}
        </div>
      )}

      {inGame && levelUp && !results && (
        <LevelUpModal
          cards={levelUp.cards}
          level={levelUp.level}
          onChoose={(card) => gameRef.current && gameRef.current.chooseCard(card)}
        />
      )}

      {inGame && paused && !results && (
        <div className="overlay pause">
          <div className="pause-panel">
            <h2>Paused</h2>
            <div className="menu-buttons">
              <button className="btn btn-primary btn-lg" onClick={() => gameRef.current && gameRef.current.togglePause()}>
                Resume
              </button>
              <button className="btn" onClick={quitToMenu}>
                Quit to menu
              </button>
            </div>
          </div>
        </div>
      )}

      {inGame && results && (
        <ResultsScreen
          results={results}
          highScore={highScore}
          onPlayAgain={() => startRun(general)}
          onChangeGeneral={() => {
            setResults(null);
            setHud(null);
            setScreen('select');
          }}
        />
      )}
    </div>
  );
}
