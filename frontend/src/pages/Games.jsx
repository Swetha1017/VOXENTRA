import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Palette, Gamepad2, Brain, Flame, Play, RotateCcw, Trophy, 
  Award, Send, Clock, Sparkles, CheckCircle2, XCircle, Zap,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Share2, ShieldCheck
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, getGlobalWSUrl } from "../api/client";
import { showToast } from "../components/Toast";
import confetti from "canvas-confetti";

// --- Color Match Constants ---
const COLOR_PALETTE = [
  { name: "RED", hex: "#ef4444" },
  { name: "BLUE", hex: "#3b82f6" },
  { name: "GREEN", hex: "#10b981" },
  { name: "YELLOW", hex: "#f59e0b" },
  { name: "PURPLE", hex: "#a855f7" },
  { name: "CYAN", hex: "#06b6d4" },
  { name: "PINK", hex: "#ec4899" },
  { name: "ORANGE", hex: "#f97316" },
];

// --- Trivia Rush Questions ---
const TRIVIA_QUESTIONS = [
  {
    question: "Which neural network architecture introduced self-attention and revolutionized LLMs?",
    options: ["Transformer", "Convolutional Neural Network (CNN)", "Recurrent Neural Network (RNN)", "Markov Decision Process"],
    correctIndex: 0,
    explanation: "The Transformer architecture (Vaswani et al., 2017) introduced self-attention, powering modern LLMs like Gemini and GPT.",
  },
  {
    question: "In JavaScript, what will `typeof NaN` evaluate to?",
    options: ["'undefined'", "'number'", "'NaN'", "'object'"],
    correctIndex: 1,
    explanation: "In JavaScript, NaN (Not-a-Number) is technically of type 'number' according to IEEE 754 floating-point standard.",
  },
  {
    question: "Which data structure operates on a Last-In, First-Out (LIFO) basis?",
    options: ["Queue", "Stack", "Binary Heap", "Hash Table"],
    correctIndex: 1,
    explanation: "A Stack pushes and pops items from the top, adhering to the LIFO principle.",
  },
  {
    question: "What is the primary transport protocol underlying true full-duplex WebSockets?",
    options: ["UDP", "TCP", "HTTP/1.0", "SMTP"],
    correctIndex: 1,
    explanation: "WebSockets initiate with an HTTP handshake and upgrade to a persistent, bidirectional TCP connection.",
  },
  {
    question: "Which Big-O complexity represents binary search on a sorted array?",
    options: ["O(1)", "O(n)", "O(log n)", "O(n log n)"],
    correctIndex: 2,
    explanation: "Binary search halves search space at each iteration, resulting in O(log n) time complexity.",
  },
];

// --- Word Blitz Valid Words ---
const VALID_WORDS = new Set([
  "VOTE", "VOTER", "VOTES", "RATE", "RATES", "NEXT", "NOTE", "NOTES", "EXTRA", "EXTRAS",
  "TORE", "RENT", "RENTS", "TEAR", "TEARS", "OVER", "NEAT", "TONE", "TONES", "ROVE",
  "ROTE", "VENT", "VENTS", "ROAN", "TARN", "OXEN", "VAST", "NEAR", "EARN", "ATON",
  "OVEN", "OVENS", "AXON", "AXONS", "RAVE", "RAVES", "AVERT", "TREAT", "EXOT", "NOT",
  "NET", "TEN", "TON", "TAR", "RAT", "OAR", "ROB", "ERA", "ATE", "EAT", "TEA", "ONE",
  "ORE", "ROE", "VAN", "VAT", "VEX", "TAX", "ROT", "RAN", "NOR", "OAT"
]);

export const Games = ({ navigate }) => {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  
  // Active game: "color_match", "snake", "trivia", "word"
  const [selectedGame, setSelectedGame] = useState("color_match");
  
  const [leaderboard, setLeaderboard] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");

  // ==========================================
  // 1. COLOR MATCH STATE
  // ==========================================
  const [cmActive, setCmActive] = useState(false);
  const [cmTime, setCmTime] = useState(30);
  const [cmScore, setCmScore] = useState(0);
  const [cmStreak, setCmStreak] = useState(0);
  const [cmWord, setCmWord] = useState(COLOR_PALETTE[0]);
  const [cmColor, setCmColor] = useState(COLOR_PALETTE[0]);
  const [cmIsMatch, setCmIsMatch] = useState(true);
  const [cmFeedback, setCmFeedback] = useState(null); // "correct" | "wrong"

  // ==========================================
  // 2. SNAKE STATE
  // ==========================================
  const GRID_SIZE = 20;
  const [snake, setSnake] = useState([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
  const [food, setFood] = useState({ x: 15, y: 10 });
  const [direction, setDirection] = useState("RIGHT");
  const [snakeScore, setSnakeScore] = useState(0);
  const [snakeGameOver, setSnakeGameOver] = useState(false);
  const [snakeRunning, setSnakeRunning] = useState(false);
  const directionRef = useRef("RIGHT");

  // ==========================================
  // 3. TRIVIA RUSH STATE
  // ==========================================
  const [triviaIndex, setTriviaIndex] = useState(0);
  const [triviaScore, setTriviaScore] = useState(0);
  const [triviaStreak, setTriviaStreak] = useState(0);
  const [triviaTimer, setTriviaTimer] = useState(15);
  const [triviaAnswered, setTriviaAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [triviaFinished, setTriviaFinished] = useState(false);

  // ==========================================
  // 4. WORD BLITZ STATE
  // ==========================================
  const [wordLetters] = useState(["V", "O", "X", "E", "N", "T", "R", "A"]);
  const [currentWord, setCurrentWord] = useState("");
  const [foundWords, setFoundWords] = useState([]);
  const [wordScore, setWordScore] = useState(0);
  const [wordTimer, setWordTimer] = useState(60);
  const [wordGameActive, setWordGameActive] = useState(false);
  const [wordFeedback, setWordFeedback] = useState("");

  // ==========================================
  // DATA LOADING & WEBSOCKET
  // ==========================================
  const loadGameData = async () => {
    try {
      const lb = await api.get(`/api/games/leaderboard?game=${selectedGame}`);
      setLeaderboard(lb || []);

      const comms = await api.get(`/api/comments?target_id=${selectedGame}`);
      setComments(comms || []);
    } catch (err) {
      console.warn("Failed to load game data:", err.message);
    }
  };

  useEffect(() => {
    loadGameData();
  }, [selectedGame]);

  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket(getGlobalWSUrl());
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "comment_add" && msg.comment?.target_id === selectedGame) {
            setComments((prev) => [msg.comment, ...prev]);
          }
        } catch (e) {
          console.error(e);
        }
      };
    } catch (e) {
      console.warn(e);
    }
    return () => {
      if (ws) ws.close();
    };
  }, [selectedGame]);

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openAuthModal("register");
      return;
    }
    if (!commentInput.trim()) return;

    try {
      await api.post("/api/comments", {
        target_id: selectedGame,
        content: commentInput.trim(),
      });
      setCommentInput("");
      showToast("Comment sent to live stream!");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // ==========================================
  // COLOR MATCH LOGIC
  // ==========================================
  const generateColorChallenge = () => {
    const wordObj = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
    const isMatch = Math.random() > 0.45;
    let colorObj = wordObj;

    if (!isMatch) {
      const remaining = COLOR_PALETTE.filter((c) => c.name !== wordObj.name);
      colorObj = remaining[Math.floor(Math.random() * remaining.length)];
    }

    setCmWord(wordObj);
    setCmColor(colorObj);
    setCmIsMatch(isMatch);
  };

  const startColorMatch = () => {
    if (!isAuthenticated) {
      openAuthModal("register");
      return;
    }
    setCmScore(0);
    setCmStreak(0);
    setCmTime(30);
    setCmActive(true);
    setCmFeedback(null);
    generateColorChallenge();
  };

  const finishColorMatch = async () => {
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    showToast(`Round Over! Final Score: ${cmScore} pts`);
    try {
      await api.post("/api/games/score", {
        game_name: "color_match",
        score: cmScore,
        accuracy: 90.0,
      });
      loadGameData();
    } catch (e) {
      console.warn("Failed to record score:", e);
    }
  };

  const handleColorChoice = (userMatches) => {
    if (!cmActive) return;

    if (userMatches === cmIsMatch) {
      const multiplier = Math.min(3, 1 + cmStreak * 0.2);
      const pointsAdded = Math.round(20 * multiplier);
      setCmScore((s) => s + pointsAdded);
      setCmStreak((st) => st + 1);
      setCmFeedback("correct");
    } else {
      setCmStreak(0);
      setCmFeedback("wrong");
    }

    setTimeout(() => setCmFeedback(null), 300);
    generateColorChallenge();
  };

  useEffect(() => {
    let timer;
    if (cmActive && cmTime > 0) {
      timer = setInterval(() => setCmTime((t) => t - 1), 1000);
    } else if (cmActive && cmTime <= 0) {
      setCmActive(false);
      finishColorMatch();
    }
    return () => clearInterval(timer);
  }, [cmActive, cmTime]);

  // ==========================================
  // SNAKE LOGIC
  // ==========================================
  const spawnFood = useCallback((currentSnake) => {
    let newFood;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      const onSnake = currentSnake.some((seg) => seg.x === newFood.x && seg.y === newFood.y);
      if (!onSnake) break;
    }
    return newFood;
  }, []);

  const startSnakeGame = () => {
    if (!isAuthenticated) {
      openAuthModal("register");
      return;
    }
    const initialSnake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    setSnake(initialSnake);
    setFood(spawnFood(initialSnake));
    setDirection("RIGHT");
    directionRef.current = "RIGHT";
    setSnakeScore(0);
    setSnakeGameOver(false);
    setSnakeRunning(true);
  };

  const changeSnakeDirection = (newDir) => {
    const cur = directionRef.current;
    if (newDir === "UP" && cur !== "DOWN") directionRef.current = "UP";
    if (newDir === "DOWN" && cur !== "UP") directionRef.current = "DOWN";
    if (newDir === "LEFT" && cur !== "RIGHT") directionRef.current = "LEFT";
    if (newDir === "RIGHT" && cur !== "LEFT") directionRef.current = "RIGHT";
    setDirection(directionRef.current);
  };

  // Keyboard navigation for Snake
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedGame !== "snake" || !snakeRunning) return;
      if (["ArrowUp", "KeyW"].includes(e.code)) {
        e.preventDefault();
        changeSnakeDirection("UP");
      } else if (["ArrowDown", "KeyS"].includes(e.code)) {
        e.preventDefault();
        changeSnakeDirection("DOWN");
      } else if (["ArrowLeft", "KeyA"].includes(e.code)) {
        e.preventDefault();
        changeSnakeDirection("LEFT");
      } else if (["ArrowRight", "KeyD"].includes(e.code)) {
        e.preventDefault();
        changeSnakeDirection("RIGHT");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedGame, snakeRunning]);

  const handleSnakeDeath = () => {
    setSnakeRunning(false);
    setSnakeGameOver(true);
    confetti({ particleCount: 70, spread: 60 });
    showToast(`Game Over! Snake Score: ${snakeScore} pts`, "info");
    api.post("/api/games/score", {
      game_name: "snake",
      score: snakeScore,
      accuracy: 100.0,
    }).then(() => loadGameData()).catch(() => {});
  };

  // Game Loop for Snake
  useEffect(() => {
    if (!snakeRunning) return;

    const interval = setInterval(() => {
      setSnake((prevSnake) => {
        const head = { ...prevSnake[0] };
        const dir = directionRef.current;

        if (dir === "UP") head.y -= 1;
        if (dir === "DOWN") head.y += 1;
        if (dir === "LEFT") head.x -= 1;
        if (dir === "RIGHT") head.x += 1;

        // Check Wall Collision
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          handleSnakeDeath();
          return prevSnake;
        }

        // Check Self Collision
        if (prevSnake.some((seg) => seg.x === head.x && seg.y === head.y)) {
          handleSnakeDeath();
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        // Check Food Collision
        if (head.x === food.x && head.y === food.y) {
          setSnakeScore((s) => s + 15);
          setFood(spawnFood(newSnake));
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    }, 130);

    return () => clearInterval(interval);
  }, [snakeRunning, food, spawnFood]);

  // ==========================================
  // TRIVIA RUSH LOGIC
  // ==========================================
  const currentTrivia = TRIVIA_QUESTIONS[triviaIndex];

  const handleTriviaAnswer = (optIndex) => {
    if (triviaAnswered) return;
    if (!isAuthenticated) {
      openAuthModal("register");
      return;
    }

    setTriviaAnswered(true);
    setSelectedOption(optIndex);

    const isCorrect = optIndex === currentTrivia.correctIndex;
    if (isCorrect) {
      const addedPoints = 20 + triviaTimer * 2 + triviaStreak * 5;
      setTriviaScore((s) => s + addedPoints);
      setTriviaStreak((st) => st + 1);
      confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
    } else {
      setTriviaStreak(0);
    }
  };

  useEffect(() => {
    let timer;
    if (selectedGame === "trivia" && !triviaAnswered && !triviaFinished && triviaTimer > 0) {
      timer = setInterval(() => setTriviaTimer((t) => t - 1), 1000);
    } else if (triviaTimer === 0 && !triviaAnswered && !triviaFinished) {
      handleTriviaAnswer(-1);
    }
    return () => clearInterval(timer);
  }, [selectedGame, triviaTimer, triviaAnswered, triviaFinished]);

  const handleNextTrivia = async () => {
    if (triviaIndex + 1 < TRIVIA_QUESTIONS.length) {
      setTriviaIndex((i) => i + 1);
      setTriviaTimer(15);
      setTriviaAnswered(false);
      setSelectedOption(null);
    } else {
      setTriviaFinished(true);
      confetti({ particleCount: 100, spread: 70 });
      try {
        await api.post("/api/games/score", {
          game_name: "trivia_rush",
          score: triviaScore,
          accuracy: Math.round((triviaScore / 250) * 100),
        });
        loadGameData();
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const resetTrivia = () => {
    setTriviaIndex(0);
    setTriviaScore(0);
    setTriviaStreak(0);
    setTriviaTimer(15);
    setTriviaAnswered(false);
    setSelectedOption(null);
    setTriviaFinished(false);
  };

  // ==========================================
  // WORD BLITZ LOGIC
  // ==========================================
  const finishWordBlitz = async () => {
    confetti({ particleCount: 80, spread: 60 });
    try {
      await api.post("/api/games/score", {
        game_name: "word_blitz",
        score: wordScore,
        accuracy: 95.0,
      });
      loadGameData();
    } catch (e) {
      console.warn(e);
    }
  };

  useEffect(() => {
    let timer;
    if (selectedGame === "word" && wordGameActive && wordTimer > 0) {
      timer = setInterval(() => setWordTimer((t) => t - 1), 1000);
    } else if (wordTimer === 0 && wordGameActive) {
      setWordGameActive(false);
      finishWordBlitz();
    }
    return () => clearInterval(timer);
  }, [selectedGame, wordGameActive, wordTimer]);

  const startWordBlitz = () => {
    if (!isAuthenticated) {
      openAuthModal("register");
      return;
    }
    setWordGameActive(true);
    setWordScore(0);
    setFoundWords([]);
    setCurrentWord("");
    setWordTimer(60);
    setWordFeedback("");
  };

  const submitWord = (e) => {
    e.preventDefault();
    const w = currentWord.trim().toUpperCase();
    if (!w) return;

    if (foundWords.includes(w)) {
      setWordFeedback("Already found!");
    } else if (VALID_WORDS.has(w)) {
      const pts = w.length * 10;
      setWordScore((s) => s + pts);
      setFoundWords((fw) => [...fw, w]);
      setWordFeedback(`+${pts} Points!`);
      confetti({ particleCount: 30, spread: 40 });
    } else {
      setWordFeedback("Not in Voxentra dictionary!");
    }
    setCurrentWord("");
    setTimeout(() => setWordFeedback(""), 1500);
  };

  // ==========================================
  // RENDER UI
  // ==========================================
  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "36px 20px" }}>
      {/* Hero Header */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(139, 92, 246, 0.15)",
          border: "1px solid rgba(139, 92, 246, 0.35)",
          padding: "6px 16px",
          borderRadius: "9999px",
          marginBottom: "14px",
        }}>
          <Zap size={16} color="#c084fc" />
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#e9d5ff" }}>
            VOXENTRA INTERACTIVE GAMING ARENA
          </span>
        </div>
        <h1 style={{ fontSize: "2.6rem", fontWeight: 900, color: "#ffffff", letterSpacing: "-0.02em", marginBottom: "8px" }}>
          Play, Vote & Climb the <span className="neon-text-cyan">Leaderboard</span>
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "1.05rem", maxWidth: "600px", margin: "0 auto" }}>
          Choose a mini game below to challenge your reflexes, test logic, earn XP rewards, and discuss live with participants!
        </p>
      </div>

      {/* STANDALONE GAME SELECTION CARDS - EXPLICIT CLICK REQUIRED */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "18px",
        marginBottom: "36px",
      }}>
        {/* Card 1: Color Match */}
        <div
          onClick={() => setSelectedGame("color_match")}
          className="glass-panel"
          style={{
            padding: "24px",
            cursor: "pointer",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            border: selectedGame === "color_match"
              ? "2px solid #8b5cf6"
              : "1px solid var(--border-subtle)",
            boxShadow: selectedGame === "color_match"
              ? "0 0 30px rgba(139, 92, 246, 0.5), inset 0 0 15px rgba(139, 92, 246, 0.2)"
              : "none",
            transform: selectedGame === "color_match" ? "scale(1.02)" : "scale(1)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {selectedGame === "color_match" && (
            <div style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
              color: "#ffffff",
              fontSize: "0.7rem",
              fontWeight: 800,
              padding: "3px 10px",
              borderRadius: "9999px",
              boxShadow: "0 0 10px rgba(236, 72, 153, 0.5)",
            }}>
              PLAYING NOW
            </div>
          )}
          <div style={{
            width: "48px",
            height: "48px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px",
            boxShadow: "0 0 15px rgba(236, 72, 153, 0.4)",
          }}>
            <Palette size={24} color="#ffffff" />
          </div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", marginBottom: "6px" }}>
            Color Match
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "14px", lineHeight: "1.4" }}>
            Rapid cognitive reflex test. Identify matching font colors under intense time pressure!
          </p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", background: "rgba(236, 72, 153, 0.15)", color: "#f472b6", padding: "2px 8px", borderRadius: "6px", fontWeight: 700 }}>
              ⏱️ 30s Blitz
            </span>
            <span style={{ fontSize: "0.72rem", background: "rgba(139, 92, 246, 0.15)", color: "#c084fc", padding: "2px 8px", borderRadius: "6px", fontWeight: 700 }}>
              +20 XP
            </span>
          </div>
        </div>

        {/* Card 2: Snake */}
        <div
          onClick={() => setSelectedGame("snake")}
          className="glass-panel"
          style={{
            padding: "24px",
            cursor: "pointer",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            border: selectedGame === "snake"
              ? "2px solid #06b6d4"
              : "1px solid var(--border-subtle)",
            boxShadow: selectedGame === "snake"
              ? "0 0 30px rgba(6, 182, 212, 0.5), inset 0 0 15px rgba(6, 182, 212, 0.2)"
              : "none",
            transform: selectedGame === "snake" ? "scale(1.02)" : "scale(1)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {selectedGame === "snake" && (
            <div style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: "linear-gradient(135deg, #06b6d4 0%, #10b981 100%)",
              color: "#ffffff",
              fontSize: "0.7rem",
              fontWeight: 800,
              padding: "3px 10px",
              borderRadius: "9999px",
              boxShadow: "0 0 10px rgba(6, 182, 212, 0.5)",
            }}>
              PLAYING NOW
            </div>
          )}
          <div style={{
            width: "48px",
            height: "48px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #06b6d4 0%, #10b981 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px",
            boxShadow: "0 0 15px rgba(6, 182, 212, 0.4)",
          }}>
            <Gamepad2 size={24} color="#ffffff" />
          </div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", marginBottom: "6px" }}>
            Snake Classic
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "14px", lineHeight: "1.4" }}>
            Classic arcade navigation. Collect neon food, grow your tail, and avoid walls!
          </p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", background: "rgba(6, 182, 212, 0.15)", color: "#22d3ee", padding: "2px 8px", borderRadius: "6px", fontWeight: 700 }}>
              🕹️ WASD / Touch
            </span>
            <span style={{ fontSize: "0.72rem", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", padding: "2px 8px", borderRadius: "6px", fontWeight: 700 }}>
              +25 XP
            </span>
          </div>
        </div>

        {/* Card 3: Trivia Rush */}
        <div
          onClick={() => setSelectedGame("trivia")}
          className="glass-panel"
          style={{
            padding: "24px",
            cursor: "pointer",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            border: selectedGame === "trivia"
              ? "2px solid #3b82f6"
              : "1px solid var(--border-subtle)",
            boxShadow: selectedGame === "trivia"
              ? "0 0 30px rgba(59, 130, 246, 0.5), inset 0 0 15px rgba(59, 130, 246, 0.2)"
              : "none",
            transform: selectedGame === "trivia" ? "scale(1.02)" : "scale(1)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {selectedGame === "trivia" && (
            <div style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
              color: "#ffffff",
              fontSize: "0.7rem",
              fontWeight: 800,
              padding: "3px 10px",
              borderRadius: "9999px",
            }}>
              PLAYING NOW
            </div>
          )}
          <div style={{
            width: "48px",
            height: "48px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px",
          }}>
            <Brain size={24} color="#ffffff" />
          </div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", marginBottom: "6px" }}>
            Trivia Rush
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "14px", lineHeight: "1.4" }}>
            Fast-paced AI & Web Dev challenges. Test algorithmic knowledge against the clock!
          </p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", padding: "2px 8px", borderRadius: "6px", fontWeight: 700 }}>
              💡 Brain Quiz
            </span>
            <span style={{ fontSize: "0.72rem", background: "rgba(139, 92, 246, 0.15)", color: "#c084fc", padding: "2px 8px", borderRadius: "6px", fontWeight: 700 }}>
              +15 XP
            </span>
          </div>
        </div>

        {/* Card 4: Word Blitz */}
        <div
          onClick={() => setSelectedGame("word")}
          className="glass-panel"
          style={{
            padding: "24px",
            cursor: "pointer",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            border: selectedGame === "word"
              ? "2px solid #f59e0b"
              : "1px solid var(--border-subtle)",
            boxShadow: selectedGame === "word"
              ? "0 0 30px rgba(245, 158, 11, 0.5), inset 0 0 15px rgba(245, 158, 11, 0.2)"
              : "none",
            transform: selectedGame === "word" ? "scale(1.02)" : "scale(1)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {selectedGame === "word" && (
            <div style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
              color: "#ffffff",
              fontSize: "0.7rem",
              fontWeight: 800,
              padding: "3px 10px",
              borderRadius: "9999px",
            }}>
              PLAYING NOW
            </div>
          )}
          <div style={{
            width: "48px",
            height: "48px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px",
          }}>
            <Flame size={24} color="#ffffff" />
          </div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", marginBottom: "6px" }}>
            Word Blitz
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "14px", lineHeight: "1.4" }}>
            Form as many anagrams as you can from 'VOXENTRA' within 60 seconds!
          </p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", padding: "2px 8px", borderRadius: "6px", fontWeight: 700 }}>
              🔠 Anagrams
            </span>
            <span style={{ fontSize: "0.72rem", background: "rgba(239, 68, 68, 0.15)", color: "#f87171", padding: "2px 8px", borderRadius: "6px", fontWeight: 700 }}>
              +30 XP
            </span>
          </div>
        </div>
      </div>

      {/* ACTIVE GAME PLAYGROUND + SIDEBAR (LEADERBOARD & LIVE COMMENTARY) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 340px",
        gap: "28px",
        alignItems: "start",
      }}>
        {/* LEFT COLUMN: ACTIVE GAME ARENA */}
        <div>
          {/* ======================================================== */}
          {/* 1. COLOR MATCH GAME ARENA */}
          {/* ======================================================== */}
          {selectedGame === "color_match" && (
            <div className="glass-panel" style={{ padding: "32px", textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "1.6rem", fontWeight: 900, color: "#ffffff", textAlign: "left" }}>
                    Color Match Challenge
                  </h2>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "left" }}>
                    Does the text meaning match the font color? Tap fast!
                  </p>
                </div>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Timer</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 900, color: cmTime <= 5 ? "#ef4444" : "#22d3ee" }}>
                      {cmTime}s
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Score</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fbbf24" }}>
                      {cmScore}
                    </div>
                  </div>
                </div>
              </div>

              {!cmActive ? (
                <div style={{ padding: "40px 20px" }}>
                  <Palette size={64} color="#8b5cf6" style={{ margin: "0 auto 16px" }} />
                  <h3 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#ffffff", marginBottom: "8px" }}>
                    Ready for the 30-Second Speed Run?
                  </h3>
                  <p style={{ color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto 24px", fontSize: "0.95rem" }}>
                    Your brain will fight between reading the word and recognizing the color. Build combos for 3x multiplier!
                  </p>
                  <button className="btn-vox-primary" onClick={startColorMatch} style={{ padding: "14px 36px", fontSize: "1.1rem" }}>
                    <Play size={20} /> Start Color Match
                  </button>
                </div>
              ) : (
                <div>
                  {/* Streak & Multiplier indicator */}
                  <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "24px" }}>
                    <span style={{
                      background: "rgba(139, 92, 246, 0.2)",
                      border: "1px solid rgba(139, 92, 246, 0.4)",
                      padding: "4px 14px",
                      borderRadius: "9999px",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "#c084fc",
                    }}>
                      🔥 Streak: {cmStreak} {cmStreak >= 3 && "· 2x BONUS"}
                    </span>
                  </div>

                  {/* Main Stroop Card */}
                  <div style={{
                    background: "rgba(0, 0, 0, 0.45)",
                    border: cmFeedback === "correct"
                      ? "3px solid #10b981"
                      : cmFeedback === "wrong"
                      ? "3px solid #ef4444"
                      : "2px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "20px",
                    padding: "50px 20px",
                    marginBottom: "32px",
                    boxShadow: cmFeedback === "correct"
                      ? "0 0 35px rgba(16, 185, 129, 0.4)"
                      : cmFeedback === "wrong"
                      ? "0 0 35px rgba(239, 68, 68, 0.4)"
                      : "none",
                    transition: "all 0.15s ease",
                  }}>
                    <div style={{
                      fontSize: "3.5rem",
                      fontWeight: 900,
                      color: cmColor.hex,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      textShadow: `0 0 25px ${cmColor.hex}66`,
                    }}>
                      {cmWord.name}
                    </div>
                  </div>

                  {/* Yes / No Choice Buttons */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", maxWidth: "480px", margin: "0 auto" }}>
                    <button
                      onClick={() => handleColorChoice(true)}
                      style={{
                        padding: "20px",
                        borderRadius: "16px",
                        background: "rgba(16, 185, 129, 0.15)",
                        border: "2px solid rgba(16, 185, 129, 0.4)",
                        color: "#34d399",
                        fontSize: "1.2rem",
                        fontWeight: 900,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                      }}
                    >
                      <CheckCircle2 size={24} /> MATCH (YES)
                    </button>

                    <button
                      onClick={() => handleColorChoice(false)}
                      style={{
                        padding: "20px",
                        borderRadius: "16px",
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "2px solid rgba(239, 68, 68, 0.4)",
                        color: "#f87171",
                        fontSize: "1.2rem",
                        fontWeight: 900,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                      }}
                    >
                      <XCircle size={24} /> NO MATCH
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* 2. SNAKE GAME ARENA */}
          {/* ======================================================== */}
          {selectedGame === "snake" && (
            <div className="glass-panel" style={{ padding: "32px", textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "14px" }}>
                <div>
                  <h2 style={{ fontSize: "1.6rem", fontWeight: 900, color: "#ffffff", textAlign: "left" }}>
                    Snake Neon Arena
                  </h2>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "left" }}>
                    Use Arrow Keys, WASD, or the on-screen touch controls below!
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Score</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#22d3ee" }}>
                    {snakeScore} pts
                  </div>
                </div>
              </div>

              {/* Game Board (20x20 Grid) */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
                <div style={{
                  width: "360px",
                  height: "360px",
                  background: "rgba(5, 7, 18, 0.95)",
                  border: "2px solid rgba(6, 182, 212, 0.4)",
                  borderRadius: "14px",
                  boxShadow: "0 0 30px rgba(6, 182, 212, 0.2)",
                  display: "grid",
                  gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                  gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {/* Grid Cells */}
                  {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
                    const x = idx % GRID_SIZE;
                    const y = Math.floor(idx / GRID_SIZE);
                    const isHead = snake[0]?.x === x && snake[0]?.y === y;
                    const isBody = snake.slice(1).some((seg) => seg.x === x && seg.y === y);
                    const isFood = food.x === x && food.y === y;

                    let bg = "transparent";
                    let shadow = "none";
                    let radius = "2px";

                    if (isHead) {
                      bg = "#22d3ee";
                      shadow = "0 0 10px #06b6d4";
                      radius = "4px";
                    } else if (isBody) {
                      bg = "#0891b2";
                      radius = "3px";
                    } else if (isFood) {
                      bg = "#ec4899";
                      shadow = "0 0 12px #ec4899";
                      radius = "50%";
                    }

                    return (
                      <div
                        key={idx}
                        style={{
                          background: bg,
                          boxShadow: shadow,
                          borderRadius: radius,
                          transition: "background 0.05s ease",
                        }}
                      />
                    );
                  })}

                  {/* Game Over Overlay */}
                  {(!snakeRunning || snakeGameOver) && (
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(4, 6, 16, 0.85)",
                      backdropFilter: "blur(6px)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px",
                    }}>
                      <Gamepad2 size={48} color="#22d3ee" style={{ marginBottom: "12px" }} />
                      <h3 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#ffffff", marginBottom: "6px" }}>
                        {snakeGameOver ? "Game Over!" : "Snake Neon"}
                      </h3>
                      <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "18px" }}>
                        {snakeGameOver ? `Final Score: ${snakeScore} pts` : "Eat pink neon dots to grow and earn XP!"}
                      </p>
                      <button className="btn-vox-primary" onClick={startSnakeGame} style={{ padding: "10px 28px" }}>
                        {snakeGameOver ? "Play Again" : "Start Game"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Touch D-Pad for Mobile & Accessibility */}
              <div style={{ maxWidth: "220px", margin: "0 auto", display: "grid", gridTemplateRows: "repeat(3, 44px)", gridTemplateColumns: "repeat(3, 44px)", gap: "6px", justifyContent: "center" }}>
                <div />
                <button
                  onClick={() => changeSnakeDirection("UP")}
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <ArrowUp size={20} />
                </button>
                <div />

                <button
                  onClick={() => changeSnakeDirection("LEFT")}
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <ArrowLeft size={20} />
                </button>
                <button
                  onClick={() => setSnakeRunning((r) => !r)}
                  style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.4)", borderRadius: "8px", color: "#22d3ee", fontSize: "0.7rem", fontWeight: 800, cursor: "pointer" }}
                >
                  {snakeRunning ? "PAUSE" : "GO"}
                </button>
                <button
                  onClick={() => changeSnakeDirection("RIGHT")}
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <ArrowRight size={20} />
                </button>

                <div />
                <button
                  onClick={() => changeSnakeDirection("DOWN")}
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <ArrowDown size={20} />
                </button>
                <div />
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 3. TRIVIA RUSH GAME ARENA */}
          {/* ======================================================== */}
          {selectedGame === "trivia" && (
            <div className="glass-panel" style={{ padding: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "1.6rem", fontWeight: 900, color: "#ffffff" }}>
                    Trivia Rush Challenge
                  </h2>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    Question {triviaIndex + 1} of {TRIVIA_QUESTIONS.length}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Time Left</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 900, color: triviaTimer <= 5 ? "#ef4444" : "#22d3ee" }}>
                      {triviaTimer}s
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Points</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fbbf24" }}>
                      {triviaScore}
                    </div>
                  </div>
                </div>
              </div>

              {!triviaFinished ? (
                <div>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#ffffff", marginBottom: "20px", lineHeight: "1.5" }}>
                    {currentTrivia.question}
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                    {currentTrivia.options.map((opt, i) => {
                      const isSelected = selectedOption === i;
                      const isCorrect = i === currentTrivia.correctIndex;
                      let btnBorder = "var(--border-subtle)";
                      let btnBg = "rgba(255,255,255,0.03)";
                      let btnColor = "var(--text-primary)";

                      if (triviaAnswered) {
                        if (isCorrect) {
                          btnBg = "rgba(16, 185, 129, 0.18)";
                          btnBorder = "#10b981";
                          btnColor = "#34d399";
                        } else if (isSelected) {
                          btnBg = "rgba(239, 68, 68, 0.18)";
                          btnBorder = "#ef4444";
                          btnColor = "#f87171";
                        }
                      }

                      return (
                        <button
                          key={i}
                          onClick={() => handleTriviaAnswer(i)}
                          disabled={triviaAnswered}
                          style={{
                            padding: "16px 20px",
                            borderRadius: "12px",
                            background: btnBg,
                            border: `1px solid ${btnBorder}`,
                            color: btnColor,
                            fontWeight: 600,
                            textAlign: "left",
                            cursor: triviaAnswered ? "default" : "pointer",
                            transition: "all 0.2s ease",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{opt}</span>
                          {triviaAnswered && isCorrect && <CheckCircle2 size={18} color="#34d399" />}
                          {triviaAnswered && isSelected && !isCorrect && <XCircle size={18} color="#f87171" />}
                        </button>
                      );
                    })}
                  </div>

                  {triviaAnswered && (
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button className="btn-vox-primary" onClick={handleNextTrivia}>
                        {triviaIndex + 1 < TRIVIA_QUESTIONS.length ? "Next Question" : "Complete Quiz"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "30px 20px" }}>
                  <Trophy size={54} color="#fbbf24" style={{ margin: "0 auto 16px" }} />
                  <h3 style={{ fontSize: "1.6rem", fontWeight: 900, color: "#ffffff", marginBottom: "6px" }}>
                    Quiz Completed!
                  </h3>
                  <p style={{ color: "var(--text-muted)", marginBottom: "20px" }}>
                    You earned <strong style={{ color: "#fbbf24" }}>{triviaScore} Points</strong>!
                  </p>
                  <button className="btn-vox-primary" onClick={resetTrivia}>
                    Play Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* 4. WORD BLITZ GAME ARENA */}
          {/* ======================================================== */}
          {selectedGame === "word" && (
            <div className="glass-panel" style={{ padding: "32px", textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "14px" }}>
                <div>
                  <h2 style={{ fontSize: "1.6rem", fontWeight: 900, color: "#ffffff", textAlign: "left" }}>
                    Word Blitz Anagrams
                  </h2>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "left" }}>
                    Form English words using letters from VOXENTRA
                  </p>
                </div>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Time</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 900, color: wordTimer <= 10 ? "#ef4444" : "#22d3ee" }}>
                      {wordTimer}s
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Score</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fbbf24" }}>
                      {wordScore}
                    </div>
                  </div>
                </div>
              </div>

              {!wordGameActive ? (
                <div style={{ padding: "30px 20px" }}>
                  <Flame size={56} color="#f59e0b" style={{ margin: "0 auto 16px" }} />
                  <h3 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#ffffff", marginBottom: "8px" }}>
                    60-Second Vocabulary Sprint
                  </h3>
                  <p style={{ color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto 20px" }}>
                    Available letters: V, O, X, E, N, T, R, A. How many words can you find?
                  </p>
                  <button className="btn-vox-primary" onClick={startWordBlitz} style={{ padding: "12px 32px" }}>
                    <Play size={18} /> Start Word Blitz
                  </button>
                </div>
              ) : (
                <div>
                  {/* Letter Tiles */}
                  <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
                    {wordLetters.map((l, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentWord((w) => w + l)}
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "10px",
                          background: "rgba(255, 255, 255, 0.08)",
                          border: "1px solid rgba(255, 255, 255, 0.2)",
                          color: "#ffffff",
                          fontSize: "1.3rem",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        {l}
                      </button>
                    ))}
                  </div>

                  {/* Word Input Form */}
                  <form onSubmit={submitWord} style={{ maxWidth: "400px", margin: "0 auto 20px", display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      value={currentWord}
                      onChange={(e) => setCurrentWord(e.target.value.toUpperCase())}
                      placeholder="Type word..."
                      className="vox-input"
                      style={{ textTransform: "uppercase", fontSize: "1.1rem", textAlign: "center", fontWeight: 700 }}
                    />
                    <button type="submit" className="btn-vox-primary">Submit</button>
                  </form>

                  {wordFeedback && (
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: wordFeedback.includes("+") ? "#34d399" : "#f87171", marginBottom: "16px" }}>
                      {wordFeedback}
                    </div>
                  )}

                  {/* Found words pills */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
                    {foundWords.map((w, i) => (
                      <span key={i} style={{ background: "rgba(6, 182, 212, 0.15)", color: "#22d3ee", padding: "3px 10px", borderRadius: "9999px", fontSize: "0.8rem", fontWeight: 700 }}>
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: LEADERBOARD & REAL-TIME COMMENTARY */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Game-Specific Leaderboard */}
          <div className="glass-panel" style={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <Trophy size={20} color="#fbbf24" />
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#ffffff" }}>
                Top Champions
              </h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {leaderboard.length === 0 ? (
                <div style={{ fontSize: "0.85rem", color: "var(--text-dim)", textAlign: "center", padding: "16px" }}>
                  No scores recorded yet. Be the first to play!
                </div>
              ) : (
                leaderboard.slice(0, 5).map((entry, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: idx === 0 ? "rgba(251, 191, 36, 0.1)" : "rgba(255, 255, 255, 0.02)",
                      border: idx === 0 ? "1px solid rgba(251, 191, 36, 0.3)" : "1px solid transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 800, color: idx === 0 ? "#fbbf24" : "var(--text-dim)", width: "16px" }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#ffffff" }}>
                        {entry.username}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#22d3ee" }}>
                      {entry.points} pts
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Live Game Commentary Stream */}
          <div className="glass-panel" style={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <Flame size={18} color="#c084fc" />
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#ffffff" }}>
                Live Player Chat
              </h3>
            </div>

            <div style={{
              height: "220px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginBottom: "14px",
              paddingRight: "4px",
            }}>
              {comments.length === 0 ? (
                <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", textAlign: "center", padding: "20px" }}>
                  Be the first to leave a comment!
                </div>
              ) : (
                comments.map((c, cIdx) => (
                  <div key={`${c.id || "comm"}-${cIdx}`} style={{ background: "rgba(255, 255, 255, 0.03)", padding: "8px 10px", borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "2px" }}>
                      <span style={{ fontWeight: 700, color: "#c084fc" }}>{c.username}</span>
                      <span style={{ color: "var(--text-dim)" }}>just now</span>
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-primary)", margin: 0 }}>
                      {c.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Comment Form */}
            <form onSubmit={handlePostComment} style={{ display: "flex", gap: "6px" }}>
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder={isAuthenticated ? "Send a comment..." : "Sign in to chat"}
                disabled={!isAuthenticated}
                className="vox-input"
                style={{ fontSize: "0.82rem", padding: "8px 12px" }}
              />
              <button
                type="submit"
                className="btn-vox-primary"
                disabled={!isAuthenticated}
                style={{ padding: "8px 12px" }}
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
