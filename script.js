// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = "https://japdvdlayamsjmyukgxn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7zq4FprR_3qP6UVBX_kuRg_2B7WxA9x";

const supabaseClient = (typeof window.supabase !== 'undefined') 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

let index = 0;
const slider = document.getElementById("slides");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const progressBar = document.getElementById("progressBar");
const dotsContainer = document.getElementById("dots");

window.currentActiveData = [];

// Master Render Logic
async function initBacklog() {
  const isAdventurePage = window.location.pathname.toLowerCase().includes("adventure");
  const pageGenre = isAdventurePage ? "adventure" : "horror";

  let rawLocalData = [];
  if (isAdventurePage) {
    if (typeof adventureData !== "undefined") rawLocalData = adventureData;
    else if (typeof genreData !== "undefined") rawLocalData = genreData;
  } else {
    if (typeof horrorData !== "undefined") rawLocalData = horrorData;
    else if (typeof genreData !== "undefined") rawLocalData = genreData;
  }

  window.currentActiveData = rawLocalData.length > 0 ? JSON.parse(JSON.stringify(rawLocalData)) : [];

  if (supabaseClient) {
    try {
      const { data: remoteGames, error } = await supabaseClient
        .from("games")
        .select("*")
        .eq("genre", pageGenre);

      if (!error && remoteGames) {
        remoteGames.forEach(item => {
          let targetCategory = window.currentActiveData.find(cat => cat.category.toLowerCase() === item.category.toLowerCase());
          
          if (!targetCategory) {
            targetCategory = { category: item.category, covers: [], games: [] };
            window.currentActiveData.push(targetCategory);
          }

          const gameExists = targetCategory.games.some(g => g.name.toLowerCase() === item.name.toLowerCase());
          if (!gameExists) {
            targetCategory.games.push({
              name: item.name,
              appId: item.app_id || "",
              psUrl: item.ps_url || "",
              status: item.status || "backlog"
            });
          }
        });
      }

      supabaseClient
        .channel('public:games')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
          initBacklog();
        })
        .subscribe();

    } catch (err) {
      console.warn("Supabase load failed, using local file only:", err);
    }
  }

  renderBacklogUI(window.currentActiveData);
}

function renderBacklogUI(data) {
  if (!data || data.length === 0) return;

  slider.style.width = `${data.length * 100}vw`;
  slider.innerHTML = data.map(cat => `
    <div class="panel">
      <h1>${cat.category}</h1>
      <div class="content">
        <div class="games">
          ${cat.games.map(game => {
            const name = game.name;
            const status = game.status || "backlog";
            return `
              <div class="game" data-appid="${game.appId || ""}" data-psurl="${game.psUrl || ""}">
                <span>${name}</span>
                <span class="status-badge ${status}">${status}</span>
              </div>`;
          }).join('')}
        </div>
        <div class="covers">
          ${(cat.covers || []).map(img => `<img src="${img}" alt="Cover" loading="lazy">`).join('')}
        </div>
      </div>
    </div>
  `).join('');

  document.querySelectorAll(".game").forEach(gameCard => {
    gameCard.addEventListener("click", () => {
      const appId = gameCard.dataset.appid;
      const psUrl = gameCard.dataset.psurl;
      const gameName = gameCard.querySelector("span").innerText.trim();

      if (appId && appId !== "") {
        window.open(`https://store.steampowered.com/app/${appId}/`, "_blank");
      } else if (psUrl && psUrl !== "") {
        window.open(psUrl, "_blank");
      } else {
        window.open(`https://store.steampowered.com/search/?term=${encodeURIComponent(gameName)}`, "_blank");
      }
    });
  });

  updateUI(window.currentActiveData);
}

function updateUI(data = window.currentActiveData) {
  slider.style.transform = `translateX(-${index * 100}vw)`;
  const dots = document.querySelectorAll(".dot");
  dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
  if (data && data.length > 0) {
    progressBar.style.width = `${((index + 1) / data.length) * 100}%`;
    if (prevBtn) prevBtn.classList.toggle("disabled", index === 0);
    if (nextBtn) nextBtn.classList.toggle("disabled", index === data.length - 1);
  }
}

function next() { 
  const currentData = window.currentActiveData;
  if (index < currentData.length - 1) { 
    index++; 
    updateUI(currentData); 
  } 
}

function prev() { 
  if (index > 0) { 
    index--; 
    updateUI(window.currentActiveData); 
  } 
}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") next();
  if (event.key === "ArrowLeft") prev();
});

let touchStartX = 0;
let touchEndX = 0;

document.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener("touchend", (e) => {
  touchEndX = e.changedTouches[0].screenX;
  if (touchStartX - touchEndX > 50) next();
  if (touchEndX - touchStartX > 50) prev();
});

initBacklog();