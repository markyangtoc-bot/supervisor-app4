(function () {
  const DATA = window.__SITE_SUPERVISOR_APP_DATA__;
  const root = document.getElementById("app");

  if (!DATA || !root) {
    return;
  }

  const STORAGE_KEYS = {
    progress: "site-supervisor-progress-v1",
    session: "site-supervisor-active-session-v7",
  };

  const maps = buildMaps(DATA);

  const state = {
    view: "home",
    session: hydrateSession(loadJson(STORAGE_KEYS.session, null)),
    progress: loadJson(STORAGE_KEYS.progress, { questions: {}, sessions: [] }),
  };

  render();

  function loadJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function buildMaps(data) {
    const scenarioById = {};
    const imageById = {};
    data.scenarioGroups.forEach((group) => {
      scenarioById[group.id] = group;
    });
    data.imageGroups.forEach((group) => {
      imageById[group.assetFilename] = {
        ...group,
        imagePath: resolveImagePath(group.assetFilename, group.imagePath),
      };
    });
    return { scenarioById, imageById };
  }

  function resolveImagePath(assetFilename, fallbackPath) {
    const filename = String(assetFilename || "").trim();
    if (filename) {
      return `./assets/question-cards/${filename}`;
    }
    return normalizeImagePath(fallbackPath);
  }

  function normalizeImagePath(path) {
    const value = String(path || "").trim();
    if (!value) {
      return "";
    }
    if (value.startsWith("../assets/")) {
      return `./assets/${value.slice("../assets/".length)}`;
    }
    if (value.startsWith("assets/")) {
      return `./${value}`;
    }
    return value;
  }

  function hydrateSession(rawSession) {
    if (!rawSession || !Array.isArray(rawSession.groups)) {
      return null;
    }

    const groups = rawSession.groups
      .map((group) => hydrateGroup(group))
      .filter(Boolean);

    if (!groups.length) {
      return null;
    }

    const questionIds = groups.flatMap((group) => group.questionIds);
    const selectedByQuestion = {};
    const feedbackByQuestion = {};

    questionIds.forEach((questionId) => {
      if (rawSession.selectedByQuestion && rawSession.selectedByQuestion[questionId]) {
        selectedByQuestion[questionId] = rawSession.selectedByQuestion[questionId];
      }
      if (rawSession.feedbackByQuestion && rawSession.feedbackByQuestion[questionId]) {
        feedbackByQuestion[questionId] = rawSession.feedbackByQuestion[questionId];
      }
    });

    const totalQuestions = groups.reduce((sum, group) => sum + group.questionIds.length, 0);
    const groupIndex = Math.min(rawSession.groupIndex || 0, groups.length - 1);
    const questionIndex = Math.min(
      rawSession.questionIndex || 0,
      groups[groupIndex].questionIds.length - 1,
    );

    return {
      ...rawSession,
      groups,
      totalQuestions,
      groupIndex,
      questionIndex,
      selectedByQuestion,
      feedbackByQuestion,
    };
  }

  function hydrateGroup(group) {
    if (!group || !Array.isArray(group.questionIds) || !group.questionIds.length) {
      return null;
    }

    const firstQuestion = DATA.questions[group.questionIds[0]];
    if (!firstQuestion) {
      return null;
    }

    if (group.mode === "image") {
      const canonical =
        maps.imageById[group.assetFilename] ||
        maps.imageById[firstQuestion.imageAssetFilename];
      if (!canonical) {
        return null;
      }
      return {
        id: canonical.id,
        mode: "image",
        title: canonical.title,
        commonStem: canonical.commonStem,
        imagePath: resolveImagePath(canonical.assetFilename, canonical.imagePath),
        assetFilename: canonical.assetFilename,
        questionIds: canonical.questionIds,
      };
    }

    if (group.mode === "scenario") {
      const canonical =
        maps.scenarioById[group.id] ||
        maps.scenarioById[firstQuestion.scenarioGroup];
      if (!canonical) {
        return null;
      }
      return {
        id: canonical.id,
        mode: "scenario",
        title: canonical.title,
        commonStem: canonical.commonStem,
        imagePath: "",
        assetFilename: "",
        questionIds: canonical.questionIds,
      };
    }

    if (firstQuestion.questionType !== "一般式") {
      return null;
    }
    if (String(firstQuestion.scenarioGroup || "").trim()) {
      return null;
    }
    if (firstQuestion.hasImage) {
      return null;
    }

    return {
      id: group.id || firstQuestion.id,
      mode: group.mode || "text",
      title: group.title || "文字題",
      commonStem: "",
      imagePath: "",
      assetFilename: "",
      questionIds: group.questionIds.filter((questionId) => Boolean(DATA.questions[questionId])),
    };
  }

  function render() {
    if (state.view === "session" && state.session) {
      renderSession();
      return;
    }

    switch (state.view) {
      case "review":
        renderReview();
        break;
      case "analysis":
        renderAnalysis();
        break;
      case "more":
        renderMore();
        break;
      default:
        renderHome();
        break;
    }
  }

  function renderShell(innerHtml, activeNav) {
    root.innerHTML = `
      <div class="screen">
        ${innerHtml}
        <div class="session-footer-space"></div>
      </div>
      ${renderBottomNav(activeNav)}
    `;
    bindGlobalActions();
  }

  function renderBottomNav(activeNav) {
    return `
      <nav class="bottom-nav">
        <button class="nav-btn ${activeNav === "home" ? "active" : ""}" data-nav="home">首頁</button>
        <button class="nav-btn ${activeNav === "review" ? "active" : ""}" data-nav="review">錯題</button>
        <button class="nav-btn ${activeNav === "analysis" ? "active" : ""}" data-nav="analysis">分析</button>
        <button class="nav-btn ${activeNav === "more" ? "active" : ""}" data-nav="more">更多</button>
      </nav>
    `;
  }

  function renderHome() {
    const counts = DATA.modeCounts;
    const todayStats = buildTodayStats();
    const continueCard = state.session
      ? `
        <div class="panel blue">
          <div class="section-header">
            <div>
              <h2 class="section-title">上次進度</h2>
              <div class="muted small">${escapeHtml(state.session.title)}</div>
            </div>
            <button class="primary-btn" data-action="continue-session">繼續作答</button>
          </div>
          <div class="small muted">目前進度：第 ${state.session.groupIndex + 1} 組，第 ${state.session.questionIndex + 1} 題</div>
        </div>
      `
      : "";

    renderShell(
      `
        <section class="hero">
          <div class="hero-top">
            <div>
              <div class="eyebrow">工地標誌風學習模式</div>
              <h1>工地主任考試<br />手機刷題站</h1>
              <p>用零碎時間練題，每題答完立即看對錯與解析，讓記憶在當下就被強化。</p>
            </div>
            <img class="hero-illustration" src="./assets/illustrations/hardhat-mascot.svg" alt="工地安全帽吉祥物" />
          </div>
        </section>

        ${continueCard}

        <section class="panel blue">
          <div class="section-header">
            <h2 class="section-title">使用說明</h2>
            <div class="muted small">學習用途提醒</div>
          </div>
          <div class="muted small">
            本系統供考古題練習使用，答案與解析以題庫整理結果為準；法規與實務如有更新，請以主管機關最新公告為準。
          </div>
          <div class="muted small" style="margin-top:8px;">
            如發現考題、答案、解析或圖卡有問題，請截圖並寄信到
            <a href="mailto:markyang.toc@gmail.com">markyang.toc@gmail.com</a>
            說明。
          </div>
        </section>

        <section class="panel">
          <div class="section-header">
            <h2 class="section-title">開始練習</h2>
            <div class="muted small">依你的使用習慣，先做最短路徑</div>
          </div>
          <div class="mode-grid">
            <article class="mode-card primary">
              <img src="./assets/illustrations/blueprint-board.svg" alt="第一類科插圖" />
              <h3>第一類科文字題</h3>
              <p>${counts.textCategory1} 題，可做 10 / 20 / 30 / 50 題快速練習。</p>
              <div class="pill-row">${renderLengthChips(1)}</div>
            </article>
            <article class="mode-card primary">
              <img src="./assets/illustrations/traffic-cone-card.svg" alt="第二類科插圖" />
              <h3>第二類科文字題</h3>
              <p>${counts.textCategory2} 題，可做 10 / 20 / 30 / 50 題快速練習。</p>
              <div class="pill-row">${renderLengthChips(2)}</div>
            </article>
            <article class="mode-card blue">
              <img src="./assets/illustrations/blueprint-board.svg" alt="情境題插圖" />
              <h3>情境題模式</h3>
              <p>${counts.scenarioGroups} 組，固定顯示共同題幹，每次隨機抽一組。</p>
              <button class="primary-btn" data-action="start-scenario">隨機 1 組</button>
            </article>
            <article class="mode-card orange">
              <img src="./assets/illustrations/hardhat-mascot.svg" alt="圖卡題插圖" />
              <h3>圖卡題模式</h3>
              <p>${counts.imageGroups} 組，固定顯示圖卡與共用說明，每次隨機抽一組。</p>
              <button class="primary-btn" data-action="start-image">隨機 1 組</button>
            </article>
          </div>
        </section>

        <section class="panel soft">
          <div class="section-header">
            <h2 class="section-title">今天狀態</h2>
            <div class="muted small">用最少時間掌握自己的節奏</div>
          </div>
          <div class="stats-grid">
            ${renderStatCard("今日作答", todayStats.attempts)}
            ${renderStatCard("今日答對", todayStats.correct)}
            ${renderStatCard("錯題累積", countWrongQuestions())}
            ${renderStatCard("收藏題", countMarked("bookmarked"))}
          </div>
        </section>

        <section class="panel">
          <div class="section-header">
            <h2 class="section-title">快速入口</h2>
            <div class="muted small">忙碌時直接進最有價值的模式</div>
          </div>
          <div class="quick-actions">
            <button class="ghost-btn" data-nav="review">錯題複習</button>
            <button class="ghost-btn" data-nav="analysis">學習分析</button>
            <button class="ghost-btn" data-action="start-random-10">今天先刷 10 題</button>
          </div>
        </section>
      `,
      "home",
    );
  }

  function renderReview() {
    const wrongGroups = buildWrongReviewGroups();
    const bookmarked = Object.entries(state.progress.questions)
      .filter(([, value]) => value.bookmarked)
      .map(([questionId]) => DATA.questions[questionId])
      .filter(Boolean)
      .slice(0, 12);

    const wrongHtml = wrongGroups.length
      ? wrongGroups
          .slice(0, 10)
          .map((group) => {
            const title =
              group.mode === "image"
                ? "圖卡題"
                : group.mode === "scenario"
                  ? "情境題"
                  : "文字題";
            return `
              <article class="review-item">
                <div class="section-header">
                  <strong>${escapeHtml(title)}</strong>
                  <span class="label-badge">${group.questionIds.length} 題</span>
                </div>
                <div class="muted small">${escapeHtml(group.preview)}</div>
              </article>
            `;
          })
          .join("")
      : renderEmpty(
          "./assets/illustrations/traffic-cone-card.svg",
          "目前還沒有錯題",
          "先去做一輪練習，系統就會自動把答錯題收進來。",
        );

    const bookmarkHtml = bookmarked.length
      ? bookmarked
          .map(
            (question) => `
              <article class="review-item">
                <div class="label-row">
                  <span class="label-badge">${escapeHtml(question.categoryLabel)}</span>
                  <span class="label-badge">${escapeHtml(question.unitName || "未分類")}</span>
                </div>
                <div>${escapeHtml(question.questionText)}</div>
              </article>
            `,
          )
          .join("")
      : renderEmpty(
          "./assets/illustrations/hardhat-mascot.svg",
          "目前還沒有收藏題",
          "遇到想反覆看的題目，可以在作答後按「加入收藏」。",
        );

    renderShell(
      `
        <section class="panel soft">
          <div class="section-header">
            <div>
              <h2 class="section-title">錯題複習</h2>
              <div class="muted small">把最容易失分的題目拉回來再看一次</div>
            </div>
            <button class="primary-btn" data-action="start-review">開始複習</button>
          </div>
        </section>

        <section class="panel">
          <div class="section-header">
            <h2 class="section-title">待複習群組</h2>
            <div class="muted small">${wrongGroups.length} 組</div>
          </div>
          <div class="review-list">${wrongHtml}</div>
        </section>

        <section class="panel blue">
          <div class="section-header">
            <h2 class="section-title">收藏題</h2>
            <div class="muted small">${bookmarked.length} 題</div>
          </div>
          <div class="review-list">${bookmarkHtml}</div>
        </section>
      `,
      "review",
    );
  }

  function renderAnalysis() {
    const progressStats = buildProgressStats();
    const topWeakUnits = progressStats.byUnit.slice(0, 6);
    const officialDistribution = DATA.distribution.byUnit.slice(0, 8);

    renderShell(
      `
        <section class="panel soft">
          <div class="section-header">
            <div>
              <h2 class="section-title">學習分析</h2>
              <div class="muted small">看出你的強項與弱項，下一輪練習更有方向</div>
            </div>
            <button class="ghost-btn" data-action="start-review">複習弱點</button>
          </div>
          <div class="stats-grid">
            ${renderStatCard("總作答", progressStats.totalAttempts)}
            ${renderStatCard("總正確率", `${progressStats.accuracy}%`)}
            ${renderStatCard("第一類正確率", `${progressStats.category1Accuracy}%`)}
            ${renderStatCard("第二類正確率", `${progressStats.category2Accuracy}%`)}
          </div>
        </section>

        <section class="panel">
          <div class="section-header">
            <h2 class="section-title">目前弱點單元</h2>
            <div class="muted small">以你的作答紀錄計算</div>
          </div>
          <div class="analysis-list">
            ${
              topWeakUnits.length
                ? topWeakUnits.map((item) => renderAnalysisRow(item.label, item.accuracy, item.attempts)).join("")
                : renderEmpty(
                    "./assets/illustrations/blueprint-board.svg",
                    "還沒有足夠資料",
                    "先做幾輪題目，系統就能開始判斷你的弱點單元。",
                  )
            }
          </div>
        </section>

        <section class="panel blue">
          <div class="section-header">
            <h2 class="section-title">考古題出題比例</h2>
            <div class="muted small">依目前已整理題庫統計</div>
          </div>
          <div class="analysis-list">
            ${officialDistribution.map((item) => renderDistributionRow(item.label, item.count, item.ratio)).join("")}
          </div>
        </section>
      `,
      "analysis",
    );
  }

  function renderMore() {
    const modeCounts = DATA.modeCounts;
    renderShell(
      `
        <section class="panel soft">
          <div class="section-header">
            <div>
              <h2 class="section-title">更多功能</h2>
              <div class="muted small">目前先做最需要的實戰功能，後續可再擴充</div>
            </div>
          </div>
          <div class="stack">
            <div class="analysis-item">
              <strong>目前題庫</strong>
              <div class="muted small">${DATA.meta.questionCount} 題，情境題 ${modeCounts.scenarioGroups} 組，圖卡題 ${modeCounts.imageGroups} 組。</div>
            </div>
            <div class="analysis-item">
              <strong>學習建議</strong>
              <div class="muted small">平日先用 10 題模式，通勤時做圖卡或情境題，假日再補 30 或 50 題完整練習。</div>
            </div>
            <div class="analysis-item">
              <strong>後續可加</strong>
              <div class="muted small">模擬考、近年題優先、老師補充解析、弱點自動加權出題。</div>
            </div>
            <div class="analysis-item">
              <strong>問題回報</strong>
              <div class="muted small">
                如發現考題、答案、解析或圖卡有問題，請截圖並寄信到
                <a href="mailto:markyang.toc@gmail.com">markyang.toc@gmail.com</a>
                說明。
              </div>
            </div>
          </div>
        </section>
      `,
      "more",
    );
  }

  function renderSession() {
    const session = state.session;
    const currentGroup = session.groups[session.groupIndex];
    const questionId = currentGroup.questionIds[session.questionIndex];
    const question = DATA.questions[questionId];
    const feedback = session.feedbackByQuestion[questionId] || null;
    const selectedIds = session.selectedByQuestion[questionId] || [];
    const progressPercent = Math.round(
      ((session.completedQuestions + (feedback ? 1 : 0)) / session.totalQuestions) * 100,
    );
    const canSubmit = question.answerType === "bonus" || selectedIds.length > 0;

    const topSection = `
      <section class="panel soft session-header">
        <div class="session-top">
          <div>
            <div class="eyebrow">${escapeHtml(session.title)}</div>
            <h2 class="section-title" style="margin-top:10px;">第 ${session.groupIndex + 1} 組 / 共 ${session.groups.length} 組</h2>
          </div>
          <button class="ghost-btn" data-action="exit-session">離開</button>
        </div>
        <div class="muted small">本次進度 ${session.completedQuestions + (feedback ? 1 : 0)} / ${session.totalQuestions}</div>
        <div class="progress-bar"><span style="width:${progressPercent}%;"></span></div>
      </section>
    `;

    const commonStem = currentGroup.commonStem
      ? `<section class="panel blue"><strong>共同題幹</strong><div style="margin-top:10px;line-height:1.75;">${escapeHtml(currentGroup.commonStem)}</div></section>`
      : "";

    const imageFrame = currentGroup.imagePath
      ? `
        <section class="panel">
          <div class="section-header">
            <h2 class="section-title">圖卡</h2>
            <div class="muted small">${escapeHtml(currentGroup.assetFilename || "")}</div>
          </div>
          <div class="image-frame" style="margin-top:12px;">
            <img src="${currentGroup.imagePath}" alt="圖卡題圖片" />
          </div>
        </section>
      `
      : "";

    root.innerHTML = `
      <div class="screen">
        ${topSection}
        ${commonStem}
        ${imageFrame}
        <section class="panel question-card">
          <div class="label-row">
            <span class="label-badge">${escapeHtml(question.categoryLabel)}</span>
            <span class="label-badge">${escapeHtml(question.unitName || "未分類")}</span>
            ${
              question.questionType !== "一般式"
                ? `<span class="label-badge">${escapeHtml(question.questionType)}</span>`
                : ""
            }
          </div>
          <div class="muted small">第 ${session.questionIndex + 1} 題 / 本組共 ${currentGroup.questionIds.length} 題</div>
          <h3 class="question-title">${escapeHtml(question.questionText)}</h3>
          <div class="option-list">
            ${renderOptions(question, selectedIds, feedback)}
          </div>
          <div class="session-actions">
            <button class="ghost-btn ${questionMarked(questionId, "bookmarked") ? "good" : ""}" data-action="toggle-bookmark" data-question-id="${questionId}">
              ${questionMarked(questionId, "bookmarked") ? "已收藏" : "加入收藏"}
            </button>
            <button class="ghost-btn ${questionMarked(questionId, "confused") ? "warn" : ""}" data-action="toggle-confused" data-question-id="${questionId}">
              ${questionMarked(questionId, "confused") ? "已標記不熟" : "我還是不懂"}
            </button>
          </div>
          ${
            feedback
              ? renderFeedback(question, feedback)
              : `
                <div class="session-actions">
                  <button class="primary-btn" data-action="submit-answer" ${canSubmit ? "" : "disabled"}>送出答案</button>
                </div>
              `
          }
        </section>
        <div class="session-footer-space"></div>
      </div>
      ${renderBottomNav("home")}
    `;

    bindSessionActions(question);
    bindGlobalActions();
  }

  function renderSessionComplete() {
    const summary = buildSessionSummary(state.session);
    root.innerHTML = `
      <div class="screen">
        <section class="hero">
          <div class="hero-top">
            <div>
              <div class="eyebrow">本次練習完成</div>
              <h1>你已完成<br />${escapeHtml(state.session.title)}</h1>
              <p>趁記憶還新鮮，建議先複習錯題或直接再來一組新的練習。</p>
            </div>
            <img class="hero-illustration" src="./assets/illustrations/hardhat-mascot.svg" alt="完成插圖" />
          </div>
        </section>
        <section class="panel">
          <div class="stats-grid">
            ${renderStatCard("作答題數", summary.total)}
            ${renderStatCard("答對題數", summary.correct)}
            ${renderStatCard("答錯題數", summary.wrong)}
            ${renderStatCard("正確率", `${summary.accuracy}%`)}
          </div>
        </section>
        <section class="panel blue">
          <div class="section-header">
            <h2 class="section-title">下一步建議</h2>
            <div class="muted small">把剛剛的記憶立刻加強</div>
          </div>
          <div class="quick-actions">
            <button class="primary-btn" data-action="start-review">複習錯題</button>
            <button class="ghost-btn" data-nav="analysis">查看分析</button>
            <button class="ghost-btn" data-nav="home">回首頁</button>
          </div>
        </section>
      </div>
      ${renderBottomNav("home")}
    `;
    bindGlobalActions();
  }

  function bindGlobalActions() {
    root.querySelectorAll("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = button.getAttribute("data-nav");
        render();
      });
    });

    root.querySelectorAll("[data-action='continue-session']").forEach((button) => {
      button.addEventListener("click", () => {
        if (state.session) {
          state.view = "session";
          render();
        }
      });
    });

    root.querySelectorAll("[data-action='start-scenario']").forEach((button) => {
      button.addEventListener("click", () => startScenarioSession());
    });

    root.querySelectorAll("[data-action='start-image']").forEach((button) => {
      button.addEventListener("click", () => startImageSession());
    });

    root.querySelectorAll("[data-action='start-random-10']").forEach((button) => {
      button.addEventListener("click", () => startTextSession("1", 10));
    });

    root.querySelectorAll("[data-action='start-review']").forEach((button) => {
      button.addEventListener("click", () => startReviewSession());
    });

    root.querySelectorAll("[data-action='start-text']").forEach((button) => {
      button.addEventListener("click", () => {
        startTextSession(button.getAttribute("data-category"), Number(button.getAttribute("data-count")));
      });
    });
  }

  function bindSessionActions(question) {
    root.querySelectorAll("[data-action='select-choice']").forEach((button) => {
      button.addEventListener("click", () => {
        updateSelection(
          question.id,
          button.getAttribute("data-choice-id"),
          button.getAttribute("data-multi") === "1",
        );
        renderSession();
      });
    });

    root.querySelectorAll("[data-action='submit-answer']").forEach((button) => {
      button.addEventListener("click", () => submitCurrentAnswer(question));
    });

    root.querySelectorAll("[data-action='next-question']").forEach((button) => {
      button.addEventListener("click", () => advanceSession());
    });

    root.querySelectorAll("[data-action='toggle-bookmark']").forEach((button) => {
      button.addEventListener("click", () => {
        toggleQuestionMark(question.id, "bookmarked");
        renderSession();
      });
    });

    root.querySelectorAll("[data-action='toggle-confused']").forEach((button) => {
      button.addEventListener("click", () => {
        toggleQuestionMark(question.id, "confused");
        renderSession();
      });
    });

    root.querySelectorAll("[data-action='exit-session']").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = "home";
        render();
      });
    });
  }

  function startTextSession(categoryNo, count) {
    const sampledIds = sample(DATA.textPools[String(categoryNo)] || [], count);
    const groups = sampledIds.map((questionId) => ({
      id: questionId,
      mode: "text",
      title: `${categoryNo === "1" ? "第一類科" : "第二類科"}文字題`,
      commonStem: "",
      imagePath: "",
      assetFilename: "",
      questionIds: [questionId],
    }));
    beginSession({
      title: `${categoryNo === "1" ? "第一類科" : "第二類科"} ${count} 題練習`,
      mode: "text",
      groups,
    });
  }

  function startScenarioSession() {
    const group = randomPick(DATA.scenarioGroups);
    if (!group) {
      return;
    }
    beginSession({
      title: "情境題模式",
      mode: "scenario",
      groups: [
        {
          id: group.id,
          mode: "scenario",
          title: group.title,
          commonStem: group.commonStem,
          imagePath: "",
          assetFilename: "",
          questionIds: group.questionIds,
        },
      ],
    });
  }

  function startImageSession() {
    const group = randomPick(DATA.imageGroups);
    if (!group) {
      return;
    }
    beginSession({
      title: "圖卡題模式",
      mode: "image",
      groups: [
        {
          id: group.id,
          mode: "image",
          title: group.title,
          commonStem: group.commonStem,
          imagePath: resolveImagePath(group.assetFilename, group.imagePath),
          assetFilename: group.assetFilename,
          questionIds: group.questionIds,
        },
      ],
    });
  }

  function startReviewSession() {
    const groups = buildWrongReviewGroups();
    if (!groups.length) {
      state.view = "review";
      render();
      return;
    }
    beginSession({
      title: "錯題複習",
      mode: "review",
      groups,
    });
  }

  function beginSession({ title, mode, groups }) {
    const totalQuestions = groups.reduce((sum, group) => sum + group.questionIds.length, 0);
    state.session = {
      id: `session-${Date.now()}`,
      title,
      mode,
      groups,
      totalQuestions,
      completedQuestions: 0,
      groupIndex: 0,
      questionIndex: 0,
      selectedByQuestion: {},
      feedbackByQuestion: {},
      startedAt: new Date().toISOString(),
    };
    saveJson(STORAGE_KEYS.session, state.session);
    state.view = "session";
    render();
  }

  function renderOptions(question, selectedIds, feedback) {
    const multipleMode = question.answerType === "multiple" || question.answerType === "all";
    return question.choices
      .map((choice) => {
        const selected = selectedIds.includes(choice.id);
        const isCorrectAnswer = question.answerIds.includes(choice.id);
        const classes = ["option-btn"];
        if (selected) {
          classes.push("selected");
        }
        if (feedback) {
          if (isCorrectAnswer) {
            classes.push("correct");
          } else if (selected && !isCorrectAnswer) {
            classes.push("wrong");
          }
        }
        return `
          <button class="${classes.join(" ")}" data-action="select-choice" data-choice-id="${choice.id}" ${feedback ? "disabled" : ""} data-multi="${multipleMode ? "1" : "0"}">
            <span class="option-letter">${choice.id}</span>
            <span>${escapeHtml(choice.text)}</span>
          </button>
        `;
      })
      .join("");
  }

  function renderFeedback(question, feedback) {
    return `
      <div class="feedback ${feedback.state}">
        <h3>${feedback.title}</h3>
        <div><strong>標準答案：</strong>${escapeHtml(question.officialAnswer || "未提供")}</div>
        <div style="margin-top:8px;"><strong>解析：</strong>${escapeHtml(question.explanation || "題庫目前尚未提供解析。")}</div>
        ${feedback.note ? `<div style="margin-top:8px;" class="muted small">${escapeHtml(feedback.note)}</div>` : ""}
      </div>
      <div class="session-actions">
        <button class="primary-btn" data-action="next-question">${getNextButtonLabel()}</button>
      </div>
    `;
  }

  function submitCurrentAnswer(question) {
    const selectedIds = state.session.selectedByQuestion[question.id] || [];
    const feedback = evaluateAnswer(question, selectedIds);
    state.session.feedbackByQuestion[question.id] = feedback;
    updateQuestionProgress(question.id, feedback.isCorrect);
    saveJson(STORAGE_KEYS.session, state.session);
    saveJson(STORAGE_KEYS.progress, state.progress);
    renderSession();
  }

  function evaluateAnswer(question, selectedIds) {
    if (question.answerType === "bonus") {
      return {
        state: "special",
        title: "本題依題庫標示為送分題",
        isCorrect: true,
        note: "此題不以一般單選判定，已依題庫標示視為正確。",
      };
    }

    const selectedSorted = [...selectedIds].sort();
    const correctSorted = [...(question.answerIds || [])].sort();
    const isCorrect =
      selectedSorted.length === correctSorted.length &&
      selectedSorted.every((value, index) => value === correctSorted[index]);

    if (question.answerType === "multiple" || question.answerType === "all") {
      return {
        state: isCorrect ? "correct" : "wrong",
        title: isCorrect ? "答對了" : "這題再看一次",
        isCorrect,
        note: "本題屬多選或特殊答案題，需完整選出題庫標示答案。",
      };
    }

    return {
      state: isCorrect ? "correct" : "wrong",
      title: isCorrect ? "答對了" : "答錯了",
      isCorrect,
      note: "",
    };
  }

  function advanceSession() {
    const session = state.session;
    const currentGroup = session.groups[session.groupIndex];
    session.completedQuestions += 1;

    if (session.questionIndex < currentGroup.questionIds.length - 1) {
      session.questionIndex += 1;
    } else if (session.groupIndex < session.groups.length - 1) {
      session.groupIndex += 1;
      session.questionIndex = 0;
    } else {
      finalizeSession();
      return;
    }

    saveJson(STORAGE_KEYS.session, session);
    renderSession();
  }

  function finalizeSession() {
    const summary = buildSessionSummary(state.session);
    state.progress.sessions.unshift({
      id: state.session.id,
      title: state.session.title,
      mode: state.session.mode,
      finishedAt: new Date().toISOString(),
      total: summary.total,
      correct: summary.correct,
      wrong: summary.wrong,
    });
    state.progress.sessions = state.progress.sessions.slice(0, 20);
    saveJson(STORAGE_KEYS.progress, state.progress);
    window.localStorage.removeItem(STORAGE_KEYS.session);
    renderSessionComplete();
    state.session = null;
  }

  function updateSelection(questionId, choiceId, multipleMode) {
    const current = state.session.selectedByQuestion[questionId] || [];
    const next = multipleMode
      ? current.includes(choiceId)
        ? current.filter((value) => value !== choiceId)
        : [...current, choiceId]
      : [choiceId];
    state.session.selectedByQuestion[questionId] = next;
    saveJson(STORAGE_KEYS.session, state.session);
  }

  function updateQuestionProgress(questionId, isCorrect) {
    const record = state.progress.questions[questionId] || {
      attempts: 0,
      correct: 0,
      wrong: 0,
      bookmarked: false,
      confused: false,
    };
    record.attempts += 1;
    if (isCorrect) {
      record.correct += 1;
    } else {
      record.wrong += 1;
    }
    record.lastAt = new Date().toISOString();
    state.progress.questions[questionId] = record;
  }

  function toggleQuestionMark(questionId, key) {
    const record = state.progress.questions[questionId] || {
      attempts: 0,
      correct: 0,
      wrong: 0,
      bookmarked: false,
      confused: false,
    };
    record[key] = !record[key];
    state.progress.questions[questionId] = record;
    saveJson(STORAGE_KEYS.progress, state.progress);
  }

  function questionMarked(questionId, key) {
    return Boolean(state.progress.questions[questionId] && state.progress.questions[questionId][key]);
  }

  function buildWrongReviewGroups() {
    const wrongIds = Object.entries(state.progress.questions)
      .filter(([, value]) => value.wrong > 0 || value.confused)
      .map(([questionId]) => questionId);
    const seen = new Set();
    const groups = [];

    wrongIds.forEach((questionId) => {
      const question = DATA.questions[questionId];
      if (!question) {
        return;
      }
      if (question.hasImage && question.imageAssetFilename) {
        const imageGroup = maps.imageById[question.imageAssetFilename];
        if (imageGroup && !seen.has(`image:${imageGroup.assetFilename}`)) {
          seen.add(`image:${imageGroup.assetFilename}`);
          groups.push({
            id: imageGroup.id,
            mode: "image",
            commonStem: imageGroup.commonStem,
            imagePath: imageGroup.imagePath,
            assetFilename: imageGroup.assetFilename,
            questionIds: imageGroup.questionIds,
            preview: imageGroup.questionIds.map((id) => DATA.questions[id].questionText).join(" / "),
          });
        }
        return;
      }
      if (question.scenarioGroup) {
        const scenarioGroup = maps.scenarioById[question.scenarioGroup];
        if (scenarioGroup && !seen.has(`scenario:${scenarioGroup.id}`)) {
          seen.add(`scenario:${scenarioGroup.id}`);
          groups.push({
            id: scenarioGroup.id,
            mode: "scenario",
            commonStem: scenarioGroup.commonStem,
            imagePath: "",
            assetFilename: "",
            questionIds: scenarioGroup.questionIds,
            preview: scenarioGroup.questionIds.map((id) => DATA.questions[id].questionText).join(" / "),
          });
        }
        return;
      }
      if (!seen.has(`text:${questionId}`)) {
        seen.add(`text:${questionId}`);
        groups.push({
          id: questionId,
          mode: "text",
          commonStem: "",
          imagePath: "",
          assetFilename: "",
          questionIds: [questionId],
          preview: question.questionText,
        });
      }
    });

    return groups;
  }

  function buildProgressStats() {
    const records = state.progress.questions;
    const all = Object.entries(records);
    const totalAttempts = all.reduce((sum, [, value]) => sum + value.attempts, 0);
    const totalCorrect = all.reduce((sum, [, value]) => sum + value.correct, 0);
    const categoryStats = {
      1: { attempts: 0, correct: 0 },
      2: { attempts: 0, correct: 0 },
    };
    const byUnit = new Map();

    all.forEach(([questionId, value]) => {
      const question = DATA.questions[questionId];
      if (!question) {
        return;
      }
      categoryStats[question.categoryNo].attempts += value.attempts;
      categoryStats[question.categoryNo].correct += value.correct;
      if (!question.unitName) {
        return;
      }
      const unitRecord = byUnit.get(question.unitName) || { label: question.unitName, attempts: 0, correct: 0 };
      unitRecord.attempts += value.attempts;
      unitRecord.correct += value.correct;
      byUnit.set(question.unitName, unitRecord);
    });

    const byUnitRows = Array.from(byUnit.values())
      .map((item) => ({
        label: item.label,
        attempts: item.attempts,
        accuracy: item.attempts ? Math.round((item.correct / item.attempts) * 100) : 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);

    return {
      totalAttempts,
      accuracy: totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
      category1Accuracy: categoryStats[1].attempts
        ? Math.round((categoryStats[1].correct / categoryStats[1].attempts) * 100)
        : 0,
      category2Accuracy: categoryStats[2].attempts
        ? Math.round((categoryStats[2].correct / categoryStats[2].attempts) * 100)
        : 0,
      byUnit: byUnitRows,
    };
  }

  function buildTodayStats() {
    const todayKey = new Date().toISOString().slice(0, 10);
    let attempts = 0;
    let correct = 0;
    Object.values(state.progress.questions).forEach((record) => {
      if ((record.lastAt || "").startsWith(todayKey)) {
        attempts += record.attempts || 0;
        correct += record.correct || 0;
      }
    });
    return { attempts, correct };
  }

  function buildSessionSummary(session) {
    const questionIds = session.groups.flatMap((group) => group.questionIds);
    const feedbackRows = questionIds
      .map((questionId) => session.feedbackByQuestion[questionId])
      .filter(Boolean);
    const correct = feedbackRows.filter((item) => item.isCorrect).length;
    const total = feedbackRows.length;
    return {
      total,
      correct,
      wrong: total - correct,
      accuracy: total ? Math.round((correct / total) * 100) : 0,
    };
  }

  function countWrongQuestions() {
    return Object.values(state.progress.questions).filter((record) => record.wrong > 0).length;
  }

  function countMarked(key) {
    return Object.values(state.progress.questions).filter((record) => record[key]).length;
  }

  function renderLengthChips(categoryNo) {
    return [10, 20, 30, 50]
      .map(
        (count) => `
          <button class="chip" data-action="start-text" data-category="${categoryNo}" data-count="${count}">
            ${count} 題
          </button>
        `,
      )
      .join("");
  }

  function renderStatCard(label, value) {
    return `
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(String(label))}</div>
        <div class="stat-value">${escapeHtml(String(value))}</div>
      </div>
    `;
  }

  function renderAnalysisRow(label, accuracy, attempts) {
    return `
      <article class="analysis-item">
        <div class="section-header">
          <strong>${escapeHtml(label)}</strong>
          <span class="muted small">${attempts} 次 / ${accuracy}%</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(accuracy, 4)}%;"></div></div>
      </article>
    `;
  }

  function renderDistributionRow(label, count, ratio) {
    return `
      <article class="analysis-item">
        <div class="section-header">
          <strong>${escapeHtml(label)}</strong>
          <span class="muted small">${count} 題 / ${ratio}%</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(Math.min(ratio, 100), 5)}%;"></div></div>
      </article>
    `;
  }

  function renderEmpty(imagePath, title, text) {
    return `
      <div class="empty">
        <img src="${imagePath}" alt="" />
        <h3>${escapeHtml(title)}</h3>
        <div class="muted small">${escapeHtml(text)}</div>
      </div>
    `;
  }

  function getNextButtonLabel() {
    if (!state.session) {
      return "下一題";
    }
    const currentGroup = state.session.groups[state.session.groupIndex];
    if (state.session.questionIndex < currentGroup.questionIds.length - 1) {
      return "下一題";
    }
    if (state.session.groupIndex < state.session.groups.length - 1) {
      return "下一組";
    }
    return "完成本次練習";
  }

  function sample(list, count) {
    const shuffled = [...list];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  function randomPick(list) {
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();
