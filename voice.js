// =============================================
//  SMART APP — Voice Assistant (EN + UR)
//  Uses: Web Speech API (SpeechRecognition + SpeechSynthesis)
//  No libraries required. Works in browser & Electron.
// =============================================

(function () {
  'use strict';

  // ── State ──────────────────────────────────
  // Load saved language or default to English
  let currentLang = localStorage.getItem('smartAppLang') || 'en-US';
  let isListening = false;
  let recognition = null;

  // ── DOM refs (set after DOMContentLoaded) ──
  let micBtn, langToggle, statusEl, typingTextEl;

  // ── Speech Recognition setup ───────────────
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn('[Voice] SpeechRecognition not supported in this browser.');
  }

  function createRecognition() {
    // --- 1. DETECT DESKTOP (OFFLINE WHISPER) MODE ---
    if (window.electronAPI && window.electronAPI.isDesktop()) {
      console.log('[Voice] Initializing Desktop Offline Recognition (Whisper)');
      return new DesktopRecognition();
    }

    // --- 2. BROWSER (ONLINE WEB SPEECH) MODE ---
    if (!SpeechRecognition) return null;
    const r = new SpeechRecognition();
    r.lang = currentLang;
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onstart = () => {
      isListening = true;
      updateUI('listening');
    };

    r.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim().toLowerCase();
      console.log('[Voice] Heard:', transcript);
      showText('You said: "' + transcript + '"');
      handleCommand(transcript);
    };

    r.onerror = (event) => {
      console.warn('[Voice] Error:', event.error);
      isListening = false;
      updateUI('idle');
      if (event.error === 'no-speech') {
        showText("I didn't hear anything. Try again!");
      } else if (event.error === 'network') {
        showText('Network error — voice needs internet.');
      } else {
        showText('Voice error: ' + event.error);
      }
    };

    r.onend = () => {
      isListening = false;
      updateUI('idle');
    };

    return r;
  }

  // --- CUSTOM DESKTOP RECOGNIZER (For Electron) ---
  class DesktopRecognition {
    constructor() {
      this.onstart = null;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.stream = null;
      this.audioContext = null;
      this.audioChunks = [];

      // Silence Detection
      this.silenceTimer = null;
      this.SILENCE_THRESHOLD = 0.01;
      this.SILENCE_DURATION = 1500; // 1.5 seconds
    }

    async start() {
      try {
        console.log('[Voice] Requesting microphone access...');
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

        this.audioChunks = [];

        this.processor.onaudioprocess = (e) => {
          if (!isListening) return;
          const inputData = e.inputBuffer.getChannelData(0);
          this.audioChunks.push(new Float32Array(inputData));

          // --- SILENCE DETECTION LOGIC ---
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);

          if (rms < this.SILENCE_THRESHOLD) {
            // User is quiet
            if (!this.silenceTimer) {
              this.silenceTimer = setTimeout(() => {
                console.log('[Voice] Auto-stopping due to silence.');
                this.stop();
              }, this.SILENCE_DURATION);
            }
          } else {
            // User is speaking
            if (this.silenceTimer) {
              clearTimeout(this.silenceTimer);
              this.silenceTimer = null;
            }
          }
        };

        source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);

        isListening = true;
        updateUI('listening');
        if (this.onstart) this.onstart();
      } catch (err) {
        console.error('[Voice] Mic error:', err);
        showText('Microphone access denied or error.');
        if (this.onerror) this.onerror({ error: 'not-allowed' });
      }
    }

    async stop() {
      if (!isListening) return;
      isListening = false;
      updateUI('idle');

      // Clear timer if manually stopped
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      const capturedChunks = this.audioChunks;

      // Cleanup recording resources immediately
      if (this.processor) this.processor.disconnect();
      if (this.audioContext) this.audioContext.close();
      if (this.stream) this.stream.getTracks().forEach(t => t.stop());

      if (capturedChunks.length === 0) {
        console.warn('[Voice] No audio captured.');
        return;
      }

      showText('Analyzing audio...');

      // 1. Flatten all Chunks into one Float32Array
      const totalLength = capturedChunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const resultBuffer = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of capturedChunks) {
        resultBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      // 2. Send to Electron for Offline Transcription
      try {
        const transcript = await window.electronAPI.transcribeAudio(resultBuffer, currentLang);

        if (transcript && transcript.error) {
          showText('Offline Error: ' + transcript.error);
          return;
        }

        if (transcript) {
          // Clean the transcript (remove trailing punctuation that breaks regex)
          const cleanText = transcript
            .trim()
            .replace(/[.,?!]$/, "") // Remove single trailing punctuation
            .replace(/\s+/g, " ")   // Normalize spaces
            .toLowerCase();

          console.log('[Voice] Desktop Heard (Cleaned):', cleanText);
          showText('You said: "' + cleanText + '"');
          handleCommand(cleanText);
        } else {
          showText("I didn't catch that. Please try again.");
        }
      } catch (err) {
        console.error('[Voice] Transcription IPC failed:', err);
        showText('Transcription failed. Check console for details.');
      }

      if (this.onend) this.onend();
    }
  }

  // ── TTS (Text-to-Speech) ───────────────────
  function speak(text, fallbackEnText = null, phoneticText = null) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);

    if (currentLang === 'ur-PK') {
      const voices = window.speechSynthesis.getVoices();
      const urduVoice = voices.find(v =>
        v.lang.startsWith('ur') || v.name.toLowerCase().includes('urdu')
      );

      if (urduVoice) {
        utter.voice = urduVoice;
        utter.lang = 'ur-PK';
      } else {
        // --- NO NATIVE URDU VOICE FOUND ---
        // Fallback to English voice but TRY to speak phonetic Urdu if provided
        utter.lang = 'en-US';
        if (phoneticText) {
          utter.text = phoneticText; // e.g. "Kaam shaamil kar liya gaya haai"
        } else if (fallbackEnText) {
          utter.text = fallbackEnText;
        } else {
          utter.text = "Urdu voice not installed.";
        }
      }
    } else {
      utter.lang = 'en-US';
    }

    utter.rate = 0.9; // Lower rate helps English voice "speak" Urdu better
    utter.pitch = 1;
    window.speechSynthesis.speak(utter);
  }

  // ── Command Router ─────────────────────────
  function getPage(baseName) {
    const isTheme2 = window.location.href.includes('theme2');
    if (isTheme2) {
      if (baseName === 'currentweather') return 'currentweathertheme2.html';
      if (baseName === 'weather') return 'weathertheme2.html';
      if (baseName === 'music') return 'music2.html';
      if (baseName === 'game') return 'gametheme2.html';
      if (baseName === 'todolist') return 'todolist2.html';
      if (baseName === 'reminder') return 'reminder2.html';
      if (baseName === 'pomodoro') return 'pomodorotheme2.html';
    }
    return baseName + '.html';
  }

  function handleCommand(text) {
    // -----------------------------------------
    // 1. SPECIFIC COMMANDS & INTENTS (Regex)
    // -----------------------------------------

    // Weather in city — "weather in Karachi" / "tell me the weather of Karachi"
    // Also support Urdu: "کراچی کا موسم" (Weather of Karachi)
    const weatherCityMatch = text.match(/(?:weather (?:in|of|for)|tell me the weather (?:in|of|for)|(.+)\s+کا\s+موسم)\s*(.+)?/);

    if (weatherCityMatch) {
      // Logic: if it's the Urdu pattern, group 1 is city. If English, group 2 is city.
      let city = "";
      if (text.includes('کا موسم')) {
        city = (weatherCityMatch[1] || "").trim();
      } else {
        city = (weatherCityMatch[2] || "").trim();
      }

      if (city) {
        respond(
          'Fetching weather for ' + city + '...',
          'معلوم کر رہا ہوں موسم کا حال ' + city + ' کے لیے...',
          'Mausam dhoond raha hoon ' + city + ' kay liyay'
        );

        const OPENWEATHER_API_KEY = "";
        fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${OPENWEATHER_API_KEY}`)
          .then(res => {
            if (!res.ok) throw new Error("City not found");
            return res.json();
          })
          .then(data => {
            const temp = Math.round(data.main.temp);
            setTimeout(() => {
              respond(
                `The temperature in ${city} is ${temp} degrees.`,
                `${city} کا درجہ حرارت ہے ${temp} ڈگری`,
                `${city} ka darja hararat hai ${temp} degree`
              );
              setTimeout(() => {
                window.location.href = getPage('currentweather') + '?city=' + encodeURIComponent(city);
              }, 3500);
            }, 1500);
          })
          .catch(err => {
            setTimeout(() => {
              respond(`Sorry, I couldn't find the weather for ${city}.`, `معاف کیجیے، مجھے ${city} کا موسم نہیں مل سکا۔`);
            }, 1500);
          });
        return;
      }
    }

    // Task Management: Add Task
    // English: "add task [name]"
    // Urdu: "[name] ٹاسک شامل کریں" or "ٹاسک بنائیں [name]"
    const addTaskMatch = text.match(/add (?:a )?task\s+(.+)|(.+)\s+(?:ٹاسک شامل کریں|ٹاسک بنائیں)/);
    if (addTaskMatch) {
      // Logic: if it's the Urdu pattern, group 2 is task. If English, group 1 is task.
      const taskName = (addTaskMatch[1] || addTaskMatch[2] || "").trim();
      if (taskName) {
        const savedTasks = JSON.parse(localStorage.getItem('priorityTasks')) || [];
        savedTasks.push({
          id: Date.now(),
          title: taskName,
          priority: "medium",
          progress: 0,
          completed: false,
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString()
        });
        localStorage.setItem('priorityTasks', JSON.stringify(savedTasks));

        respond(
          'Added task ' + taskName + ' to your to do list.',
          'ٹاسک ' + taskName + ' شامل کر دیا گیا ہے۔',
          'Task ' + taskName + ' shaamil hogaya'
        );
        setTimeout(() => { window.location.href = getPage('todolist'); }, 2500);
        return;
      }
    }

    // Task Management: Delete Task
    // English: "delete task [name]"
    // Urdu: "[name] ٹاسک ختم کریں" or "ٹاسک حذف کریں [name]"
    const deleteTaskMatch = text.match(/delete (?:a )?task\s+(.+)|(.+)\s+(?:ٹاسک ختم کریں|ٹاسک حذف کریں)/);
    if (deleteTaskMatch) {
      const taskName = (deleteTaskMatch[1] || deleteTaskMatch[2] || "").trim();
      if (taskName) {
        let savedTasks = JSON.parse(localStorage.getItem('priorityTasks')) || [];
        const initialLength = savedTasks.length;

        savedTasks = savedTasks.filter(t => t.title.toLowerCase() !== taskName.toLowerCase());

        if (savedTasks.length < initialLength) {
          localStorage.setItem('priorityTasks', JSON.stringify(savedTasks));
          respond(
            'Deleted task ' + taskName + ' from your list.',
            'ٹاسک ' + taskName + ' حذف کر دیا گیا ہے۔',
            'Task ' + taskName + ' khatam kar diya'
          );
        } else {
          respond(
            'I could not find a task named ' + taskName,
            'مجھے ' + taskName + ' نام کا کوئی ٹاسک نہیں ملا۔',
            'Mujhay ' + taskName + ' naam ka koi task nahi mila'
          );
        }
        setTimeout(() => { window.location.href = getPage('todolist'); }, 3000);
        return;
      }
    }

    // Pomodoro Navigation & Control
    if (text.includes('pomodoro') || text.includes('پومودورو')) {
      if (text.includes('start') || text.includes('شروع')) {
        respond('Starting Pomodoro timer!', 'پومودورو شروع کر رہا ہوں!', 'Pomodoro shuroo kar raha hoon');
        setTimeout(() => { window.location.href = getPage('pomodoro') + '?action=start'; }, 2000);
      } else if (text.includes('stop') || text.includes('pause') || text.includes('روکیں') || text.includes('روک دیں')) {
        respond('Stopping Pomodoro timer!', 'پومودورو روک رہا ہوں!', 'Pomodoro rok raha hoon');
        setTimeout(() => { window.location.href = getPage('pomodoro') + '?action=stop'; }, 2000);
      } else if (text.includes('reset') || text.includes('دوبارہ')) {
        respond('Resetting Pomodoro timer!', 'پومودورو ری سیٹ کر رہا ہوں!', 'Pomodoro reset kar raha hoon');
        setTimeout(() => { window.location.href = getPage('pomodoro') + '?action=reset'; }, 2000);
      } else {
        respond('Opening Pomodoro focus timer!', 'پومودورو کھول رہا ہوں!', 'Pomodoro khol raha hoon');
        setTimeout(() => { window.location.href = getPage('pomodoro'); }, 1500);
      }
      return;
    }

    // Search — "search cats" / "تلاش cats"
    const searchMatch = text.match(/(?:search|تلاش|کے بارے میں بتائیں)\s+(.+)/);
    if (searchMatch) {
      const query = searchMatch[1].trim();
      respond('Searching for ' + query + '!', 'تلاش کر رہا ہوں ' + query + '!', query + ' talaash kar raha hoon');
      setTimeout(() => {
        window.open('https://www.google.com/search?q=' + encodeURIComponent(query), '_blank');
      }, 1200);
      return;
    }

    // -----------------------------------------
    // 2. GENERIC NAVIGATION & FALLBACKS
    // -----------------------------------------

    // Navigation commands — English
    if (text.includes('open weather') || text.includes('weather')) {
      respond('Opening weather!', 'کھول رہا ہوں موسم!', 'Mausam khol raha hoon');
      setTimeout(() => { window.location.href = getPage('weather'); }, 1200);
      return;
    }
    if (text.includes('open music') || text.includes('music')) {
      respond('Opening music player!', 'میوزک چلا رہا ہوں!', 'Music chala raha hoon');
      setTimeout(() => { window.location.href = getPage('music'); }, 1200);
      return;
    }
    if (text.includes('open game') || text.includes('game')) {
      respond('Let\'s play!', 'چلو کھیلتے ہیں!', 'Chalo khayltay hain');
      setTimeout(() => { window.location.href = getPage('game'); }, 1200);
      return;
    }
    if (text.includes('open task') || text.includes('task') || text.includes('todo') || text.includes('to do')) {
      respond('Opening your tasks!', 'آپ کے کام دکھا رہا ہوں!', 'Aap kay kaam dikha raha hoon');
      setTimeout(() => { window.location.href = getPage('todolist'); }, 1200);
      return;
    }
    if (text.includes('reminder') || text.includes('remind')) {
      respond('Opening reminders!', 'یاد دہانی کھول رہا ہوں!', 'Yaad-dahani khol raha hoon');
      setTimeout(() => { window.location.href = getPage('reminder'); }, 1200);
      return;
    }

    // Urdu navigation keywords
    if (text.includes('موسم')) {
      respond('Opening weather!', 'موسم کھول رہا ہوں!', 'Mausam khol raha hoon');
      setTimeout(() => { window.location.href = getPage('weather'); }, 1200);
      return;
    }
    if (text.includes('موسیقی') || text.includes('گانا') || text.includes('میوزک')) {
      respond('Opening music!', 'موسیقی چلا رہا ہوں!', 'Music chala raha hoon');
      setTimeout(() => { window.location.href = getPage('music'); }, 1200);
      return;
    }
    if (text.includes('گیم') || text.includes('کھیل')) {
      respond('Let\'s play!', 'چلو کھیلتے ہیں!', 'Chalo khayltay hain');
      setTimeout(() => { window.location.href = getPage('game'); }, 1200);
      return;
    }
    if (text.includes('کام') || text.includes('فہرست')) {
      respond('Opening tasks!', 'کام دکھا رہا ہوں!', 'Kaam dikha raha hoon');
      setTimeout(() => { window.location.href = getPage('todolist'); }, 1200);
      return;
    }
    if (text.includes('یاد') || text.includes('یاد دہانی')) {
      respond('Opening reminders!', 'یاد دہانی کھول رہا ہوں!', 'Yaad-dahani khol raha hoon');
      setTimeout(() => { window.location.href = getPage('reminder'); }, 1200);
      return;
    }

    // Greetings
    if (text.includes('hello') || text.includes('hi') || text.includes('hey') ||
      text.includes('ہیلو') || text.includes('سلام') || text.includes('آداب')) {
      if (currentLang === 'ur-PK') {
        respond('ہیلو! میں آپ کا ذہین اسسٹنٹ ہوں۔', 'ہیلو! میں آپ کا ذہین اسسٹنٹ ہوں۔', 'Hello, may aap ka assistant hoon');
      } else {
        respond('Hello! I am your smart assistant.', '');
      }
      return;
    }

    // Time
    if (text.includes('time') || text.includes('وقت')) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      respond('The current time is ' + timeStr, 'ابھی وقت ہے ' + timeStr, 'Abhi waqt hai ' + timeStr);
      return;
    }

    // Unrecognized
    if (currentLang === 'ur-PK') {
      respond('معاف کیجیے، میں سمجھ نہیں سکا۔ دوبارہ کوشش کریں۔', 'معاف کیجیے، سمجھ نہیں آیا دوبارہ کہیں', 'Maaf kijiyay, samajh nahi aaya');
    } else {
      respond('Sorry, I didn\'t understand that. Try saying "open weather" or "search something".', '');
    }
  }

  // ── Respond: show text + speak ─────────────
  function respond(enText, urText, phoneticUrText = null) {
    const msg = (currentLang === 'ur-PK' && urText) ? urText : enText;
    showText(msg);
    // Use phoneticUrText if we are in Urdu mode but system might lack the voice
    speak(msg, enText, (currentLang === 'ur-PK') ? (phoneticUrText || enText) : null);
  }

  // ── UI Helpers ─────────────────────────────
  function showText(text) {
    if (typingTextEl) typingTextEl.textContent = text;
  }

  function updateUI(state) {
    if (!micBtn || !statusEl) return;
    if (state === 'listening') {
      micBtn.classList.add('mic-active');
      statusEl.textContent = currentLang === 'ur-PK' ? 'سن رہا ہوں…' : 'Listening…';
    } else {
      micBtn.classList.remove('mic-active');
      statusEl.textContent = '';
    }
  }

  // ── Mic toggle ─────────────────────────────
  function toggleMic() {
    if (isListening) {
      if (recognition) recognition.stop();
      isListening = false;
      updateUI('idle');
    } else {
      recognition = createRecognition();
      if (!recognition) {
        showText('Voice recognition is not supported in this browser. Try Chrome.');
        return;
      }
      recognition.lang = currentLang;
      try { recognition.start(); } catch (e) { console.warn(e); }
    }
  }

  // ── Language toggle ────────────────────────
  function toggleLang() {
    if (isListening && recognition) recognition.stop();
    currentLang = (currentLang === 'en-US') ? 'ur-PK' : 'en-US';

    // PERSIST SELECTION
    localStorage.setItem('smartAppLang', currentLang);

    if (langToggle) {
      langToggle.textContent = currentLang === 'ur-PK' ? '🌐 اردو' : '🌐 EN';
    }
    // Check for Urdu voice presence
    const voices = window.speechSynthesis.getVoices();
    const urduVoice = voices.find(v => v.lang.startsWith('ur') || v.name.toLowerCase().includes('urdu'));

    if (currentLang === 'ur-PK' && !urduVoice) {
      showText('Urdu voice missing! Install Windows Urdu Language Pack for best experience.');
      setTimeout(() => {
        showText('اردو منتخب — (سسٹم میں اردو آواز موجود نہیں)');
      }, 2500);
    } else {
      showText(currentLang === 'ur-PK' ? 'اردو زبان منتخب کی گئی۔' : 'Switched to English.');
    }

    speak(
      currentLang === 'ur-PK' ? 'اردو منتخب' : 'Switched to English.',
      currentLang === 'ur-PK' ? 'Language Switched' : null,
      currentLang === 'ur-PK' ? 'Urdu mun-ta-khib' : null
    );
  }

  // ── Init ───────────────────────────────────
  function init() {
    micBtn = document.querySelector('.mic-btn');
    langToggle = document.getElementById('lang-toggle');
    statusEl = document.getElementById('voice-status');
    typingTextEl = document.getElementById('typing-text');

    if (langToggle) {
      langToggle.textContent = currentLang === 'ur-PK' ? '🌐 اردو' : '🌐 EN';
    }

    if (micBtn) micBtn.addEventListener('click', toggleMic);
    if (langToggle) langToggle.addEventListener('click', toggleLang);

    // Pre-load voices list (Chrome needs this)
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices(); // cache loaded
      };
    }

    if (typingTextEl) {
      typingTextEl.textContent = 'Click the mic and speak a command!';
    }

    // Also handle commands typed in the text box (Enter key)
    const textInput = document.getElementById('text-input');
    if (textInput) {
      textInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          const val = textInput.value.trim().toLowerCase();
          if (val) {
            showText('You typed: "' + val + '"');
            handleCommand(val);
            textInput.value = '';
          }
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
