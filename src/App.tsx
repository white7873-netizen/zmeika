import { useState, useEffect, useCallback, useRef } from 'react';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Difficulty = 'easy' | 'medium' | 'hard';

const GRID_SIZE = 20;
const CELL_SIZE_DESKTOP = 25;
const CELL_SIZE_MOBILE = 18;

const SPEEDS: Record<Difficulty, number> = {
  easy: 150,
  medium: 100,
  hard: 60,
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Легко',
  medium: 'Средне',
  hard: 'Сложно',
};

function App() {
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snakeHighScore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gameStarted, setGameStarted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const directionRef = useRef<Direction>(direction);
  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const cellSize = isMobile ? CELL_SIZE_MOBILE : CELL_SIZE_DESKTOP;
  const canvasSize = GRID_SIZE * cellSize;

  // Generate food
  const generateFood = useCallback((currentSnake: Position[]): Position => {
    let newFood: Position;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (currentSnake.some(seg => seg.x === newFood.x && seg.y === newFood.y));
    return newFood;
  }, []);

  // Reset game
  const resetGame = useCallback(() => {
    const initialSnake = [{ x: 10, y: 10 }];
    setSnake(initialSnake);
    setFood(generateFood(initialSnake));
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    setGameOver(false);
    setIsPaused(false);
    setScore(0);
    setGameStarted(true);
  }, [generateFood]);

  // Game loop
  const moveSnake = useCallback(() => {
    setSnake(prevSnake => {
      const head = { ...prevSnake[0] };
      const currentDir = directionRef.current;

      switch (currentDir) {
        case 'UP': head.y -= 1; break;
        case 'DOWN': head.y += 1; break;
        case 'LEFT': head.x -= 1; break;
        case 'RIGHT': head.x += 1; break;
      }

      // Check wall collision
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        setGameOver(true);
        setGameStarted(false);
        return prevSnake;
      }

      // Check self collision
      if (prevSnake.some(seg => seg.x === head.x && seg.y === head.y)) {
        setGameOver(true);
        setGameStarted(false);
        return prevSnake;
      }

      const newSnake = [head, ...prevSnake];

      // Check food collision
      if (head.x === food.x && head.y === food.y) {
        setScore(prev => {
          const newScore = prev + 10;
          if (newScore > highScore) {
            setHighScore(newScore);
            localStorage.setItem('snakeHighScore', newScore.toString());
          }
          return newScore;
        });
        setFood(generateFood(newSnake));
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [food, generateFood, highScore]);

  // Game loop interval
  useEffect(() => {
    if (gameStarted && !isPaused && !gameOver) {
      gameLoopRef.current = window.setInterval(moveSnake, SPEEDS[difficulty]);
    }
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameStarted, isPaused, gameOver, moveSnake, difficulty]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        if (gameStarted && !gameOver) {
          setIsPaused(prev => !prev);
        }
        return;
      }

      if (e.key === 'Enter' && (gameOver || !gameStarted)) {
        resetGame();
        return;
      }

      const currentDir = directionRef.current;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          if (currentDir !== 'DOWN') {
            directionRef.current = 'UP';
            setDirection('UP');
          }
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          if (currentDir !== 'UP') {
            directionRef.current = 'DOWN';
            setDirection('DOWN');
          }
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          if (currentDir !== 'RIGHT') {
            directionRef.current = 'LEFT';
            setDirection('LEFT');
          }
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          if (currentDir !== 'LEFT') {
            directionRef.current = 'RIGHT';
            setDirection('RIGHT');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStarted, gameOver, resetGame]);

  // Touch controls
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const minSwipe = 30;

    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;

    const currentDir = directionRef.current;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && currentDir !== 'LEFT') {
        directionRef.current = 'RIGHT';
        setDirection('RIGHT');
      } else if (dx < 0 && currentDir !== 'RIGHT') {
        directionRef.current = 'LEFT';
        setDirection('LEFT');
      }
    } else {
      if (dy > 0 && currentDir !== 'UP') {
        directionRef.current = 'DOWN';
        setDirection('DOWN');
      } else if (dy < 0 && currentDir !== 'DOWN') {
        directionRef.current = 'UP';
        setDirection('UP');
      }
    }
    touchStartRef.current = null;
  };

  // D-pad button handlers
  const handleDPad = (dir: Direction) => {
    const currentDir = directionRef.current;
    if (
      (dir === 'UP' && currentDir !== 'DOWN') ||
      (dir === 'DOWN' && currentDir !== 'UP') ||
      (dir === 'LEFT' && currentDir !== 'RIGHT') ||
      (dir === 'RIGHT' && currentDir !== 'LEFT')
    ) {
      directionRef.current = dir;
      setDirection(dir);
    }
  };

  // Store refs for rendering
  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  snakeRef.current = snake;
  foodRef.current = food;

  // Canvas rendering with animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;

    const render = () => {
      const currentSnake = snakeRef.current;
      const currentFood = foodRef.current;

      // Clear canvas
      ctx.clearRect(0, 0, canvasSize, canvasSize);

      // Draw grid background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      // Draw grid lines
      ctx.strokeStyle = '#16213e';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, canvasSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvasSize, i * cellSize);
        ctx.stroke();
      }

      // Draw snake
      currentSnake.forEach((segment, index) => {
        const isHead = index === 0;
        const progress = index / currentSnake.length;

        if (isHead) {
          // Head with gradient
          const gradient = ctx.createRadialGradient(
            segment.x * cellSize + cellSize / 2,
            segment.y * cellSize + cellSize / 2,
            0,
            segment.x * cellSize + cellSize / 2,
            segment.y * cellSize + cellSize / 2,
            cellSize / 2
          );
          gradient.addColorStop(0, '#4ade80');
          gradient.addColorStop(1, '#16a34a');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(
            segment.x * cellSize + 1,
            segment.y * cellSize + 1,
            cellSize - 2,
            cellSize - 2,
            cellSize / 4
          );
          ctx.fill();

          // Eyes
          ctx.fillStyle = '#fff';
          const eyeSize = cellSize / 6;
          const eyeOffset = cellSize / 4;
          let eye1X = segment.x * cellSize + cellSize / 2;
          let eye1Y = segment.y * cellSize + cellSize / 2;
          let eye2X = eye1X;
          let eye2Y = eye1Y;

          switch (directionRef.current) {
            case 'RIGHT':
              eye1X += eyeOffset; eye1Y -= eyeOffset / 2;
              eye2X += eyeOffset; eye2Y += eyeOffset / 2;
              break;
            case 'LEFT':
              eye1X -= eyeOffset; eye1Y -= eyeOffset / 2;
              eye2X -= eyeOffset; eye2Y += eyeOffset / 2;
              break;
            case 'UP':
              eye1X -= eyeOffset / 2; eye1Y -= eyeOffset;
              eye2X += eyeOffset / 2; eye2Y -= eyeOffset;
              break;
            case 'DOWN':
              eye1X -= eyeOffset / 2; eye1Y += eyeOffset;
              eye2X += eyeOffset / 2; eye2Y += eyeOffset;
              break;
          }

          ctx.beginPath();
          ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
          ctx.fill();

          // Pupils
          ctx.fillStyle = '#1a1a2e';
          ctx.beginPath();
          ctx.arc(eye1X, eye1Y, eyeSize / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(eye2X, eye2Y, eyeSize / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Body segments with gradient
          const hue = 140 + progress * 20;
          const lightness = 45 - progress * 15;
          ctx.fillStyle = `hsl(${hue}, 70%, ${lightness}%)`;
          ctx.beginPath();
          ctx.roundRect(
            segment.x * cellSize + 2,
            segment.y * cellSize + 2,
            cellSize - 4,
            cellSize - 4,
            cellSize / 5
          );
          ctx.fill();
        }
      });

      // Draw food with pulse animation
      const pulse = Math.sin(Date.now() / 200) * 2 + cellSize / 2 - 2;
      const foodGradient = ctx.createRadialGradient(
        currentFood.x * cellSize + cellSize / 2,
        currentFood.y * cellSize + cellSize / 2,
        0,
        currentFood.x * cellSize + cellSize / 2,
        currentFood.y * cellSize + cellSize / 2,
        pulse
      );
      foodGradient.addColorStop(0, '#ff6b6b');
      foodGradient.addColorStop(0.7, '#ee5a24');
      foodGradient.addColorStop(1, '#c0392b');

      ctx.save();
      ctx.shadowColor = '#ff6b6b';
      ctx.shadowBlur = 10;
      ctx.fillStyle = foodGradient;
      ctx.beginPath();
      ctx.arc(
        currentFood.x * cellSize + cellSize / 2,
        currentFood.y * cellSize + cellSize / 2,
        pulse - 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();

      animFrame = requestAnimationFrame(render);
    };

    animFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrame);
  }, [cellSize, canvasSize]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex flex-col items-center justify-center p-4 select-none">
      {/* Header */}
      <div className="mb-4 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 mb-2">
          🐍 Змейка
        </h1>
        <div className="flex items-center justify-center gap-4 md:gap-8 text-sm md:text-base">
          <div className="bg-slate-800/80 backdrop-blur px-4 py-2 rounded-xl border border-slate-700">
            <span className="text-slate-400">Счёт: </span>
            <span className="text-green-400 font-bold text-lg">{score}</span>
          </div>
          <div className="bg-slate-800/80 backdrop-blur px-4 py-2 rounded-xl border border-slate-700">
            <span className="text-slate-400">Рекорд: </span>
            <span className="text-yellow-400 font-bold text-lg">{highScore}</span>
          </div>
        </div>
      </div>

      {/* Difficulty selector */}
      <div className="mb-4 flex items-center gap-2">
        {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => (
          <button
            key={diff}
            onClick={() => {
              setDifficulty(diff);
              if (!gameStarted || gameOver) {
                // Will apply on next game start
              }
            }}
            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 ${
              difficulty === diff
                ? diff === 'easy'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-lg shadow-green-500/10'
                  : diff === 'medium'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 shadow-lg shadow-yellow-500/10'
                  : 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-lg shadow-red-500/10'
                : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600'
            }`}
          >
            {DIFFICULTY_LABELS[diff]}
          </button>
        ))}
      </div>

      {/* Game Canvas */}
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl shadow-green-900/20 border-2 border-slate-700/50"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          className="block"
        />

        {/* Overlay: Start screen */}
        {!gameStarted && !gameOver && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
            <div className="text-6xl mb-4">🐍</div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Змейка</h2>
            <p className="text-slate-300 text-sm mb-6 text-center px-4">
              {isMobile ? 'Свайпайте для управления' : 'Используйте стрелки или WASD'}
            </p>
            <button
              onClick={resetGame}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105 transition-all duration-200"
            >
              Начать игру
            </button>
            <p className="text-slate-500 text-xs mt-4">или нажмите Enter</p>
          </div>
        )}

        {/* Overlay: Game Over */}
        {gameOver && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
            <div className="text-5xl mb-4">💀</div>
            <h2 className="text-2xl md:text-3xl font-bold text-red-400 mb-2">Игра окончена!</h2>
            <p className="text-slate-300 text-lg mb-1">Счёт: <span className="text-green-400 font-bold">{score}</span></p>
            {score >= highScore && score > 0 && (
              <p className="text-yellow-400 text-sm mb-4 animate-pulse">🏆 Новый рекорд!</p>
            )}
            <button
              onClick={resetGame}
              className="mt-4 px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105 transition-all duration-200"
            >
              Играть снова
            </button>
            <p className="text-slate-500 text-xs mt-4">или нажмите Enter</p>
          </div>
        )}

        {/* Overlay: Paused */}
        {isPaused && !gameOver && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
            <div className="text-5xl mb-4">⏸️</div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Пауза</h2>
            <p className="text-slate-300 text-sm mb-6">Нажмите пробел для продолжения</p>
            <button
              onClick={() => setIsPaused(false)}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 transition-all duration-200"
            >
              Продолжить
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 flex items-center gap-3">
        {gameStarted && !gameOver && (
          <button
            onClick={() => setIsPaused(prev => !prev)}
            className="px-4 py-2 bg-slate-800/80 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-700/80 transition-all duration-200 text-sm"
          >
            {isPaused ? '▶ Продолжить' : '⏸ Пауза'}
          </button>
        )}
        <button
          onClick={resetGame}
          className="px-4 py-2 bg-slate-800/80 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-700/80 transition-all duration-200 text-sm"
        >
          🔄 Перезапуск
        </button>
      </div>

      {/* Mobile D-Pad */}
      {isMobile && gameStarted && !gameOver && (
        <div className="mt-6 grid grid-cols-3 gap-2 w-40">
          <div></div>
          <button
            onTouchStart={(e) => { e.preventDefault(); handleDPad('UP'); }}
            className="w-12 h-12 mx-auto bg-slate-800/80 border border-slate-600 rounded-xl flex items-center justify-center text-white text-xl active:bg-slate-700 active:scale-95 transition-all"
          >
            ↑
          </button>
          <div></div>
          <button
            onTouchStart={(e) => { e.preventDefault(); handleDPad('LEFT'); }}
            className="w-12 h-12 mx-auto bg-slate-800/80 border border-slate-600 rounded-xl flex items-center justify-center text-white text-xl active:bg-slate-700 active:scale-95 transition-all"
          >
            ←
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); handleDPad('DOWN'); }}
            className="w-12 h-12 mx-auto bg-slate-800/80 border border-slate-600 rounded-xl flex items-center justify-center text-white text-xl active:bg-slate-700 active:scale-95 transition-all"
          >
            ↓
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); handleDPad('RIGHT'); }}
            className="w-12 h-12 mx-auto bg-slate-800/80 border border-slate-600 rounded-xl flex items-center justify-center text-white text-xl active:bg-slate-700 active:scale-95 transition-all"
          >
            →
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 text-center text-slate-500 text-xs max-w-md">
        {!isMobile && (
          <p>
            <span className="text-slate-400">Управление:</span> Стрелки / WASD — движение • Пробел — пауза • Enter — перезапуск
          </p>
        )}
        {isMobile && (
          <p>
            <span className="text-slate-400">Управление:</span> Свайп по полю или кнопки-стрелки
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
