/* -------------------------------------------------
   Masa & Community – Client‑side Logic
   -------------------------------------------------
   Features:
   • Local‑first storage (localStorage)
   • Role‑based routing (admin / seller / buyer)
   • Image upload (stores & listings) – Base‑64 data URLs
   • Prices displayed in UGX
   • Search, filter, cart, comments/ratings
   • WhatsApp‑style messaging (double‑ticks, blue ticks)
   ------------------------------------------------- */

(() => {
  /* ------------------- Constants & Helpers ------------------- */
  const STORAGE_KEY = "masaAppData";
  const SESSION_KEY = "masaCurrentUser";
  const CURRENCY = "UGX";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const generateId = () => "_" + Math.random().toString(36).substr(2, 9);
  const now = () => new Date().toISOString();

  const formatPrice = (val) => {
    const n = Number(val);
    return `UGX ${isNaN(n) ? "0" : n.toLocaleString("en-US")}`;
  };

  const escapeHtml = (str) => {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  /* ------------------- Default Data Model ------------------- */
  const defaultData = {
    users: [],            // {id, username, password, role, storeId}
    stores: [],          // {id, sellerId, name, description, imageUrl}
    listings: [],        // {id, storeId, title, description, price, type, imageUrl, createdAt}
    orders: [],          // {id, buyerId, storeId, listingId, quantity, notes, status, createdAt}
    comments: [],        // {id, listingId, buyerId, rating, text, createdAt}
    carts: [],           // {userId, items:[{listingId, quantity}]}
    messages: []         // {id, fromId, toId, subject, body, timestamp, read}
  };

  /* ------------------- Load / Save ------------------- */
  let appData = loadAppData();

  function loadAppData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
      return JSON.parse(JSON.stringify(defaultData));
    }
    try {
      const parsed = JSON.parse(raw);
      const keys = [
        "users",
        "stores",
        "listings",
        "orders",
        "comments",
        "carts",
        "messages"
      ];
      keys.forEach((k) => {
        if (!Array.isArray(parsed[k])) parsed[k] = [];
      });
      return parsed;
    } catch (_) {
      console.error("Corrupted storage – resetting.");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
      return JSON.parse(JSON.stringify(defaultData));
    }
  }

  function saveAppData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  }

  /* ------------------- Session ------------------- */
  function setCurrentUser(userId) {
    sessionStorage.setItem(SESSION_KEY, userId);
  }
  function getCurrentUser() {
    const id = sessionStorage.getItem(SESSION_KEY);
    return id ? appData.users.find((u) => u.id === id) : null;
  }
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    location.hash = "#login";
  }

  /* ------------------- Seed Admin ------------------- */
  function seedAdmin() {
    const exists = appData.users.some((u) => u.username === "Masanso David");
    if (!exists) {
      appData.users.push({
        id: generateId(),
        username: "Masanso David",
        password: "0764411.Pet?",
        role: "admin"
      });
      saveAppData();
    }
  }
  seedAdmin();

  /* ------------------- Toast (global UI feedback) ------------------- */
  function showToast(message, type = "info") {
    const container = $("#toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
  function showMessage(msg) {
    showToast(msg, "info");
  }

  /* ------------------- Data Look‑ups ------------------- */
  const getUserById = (id) => appData.users.find((u) => u.id === id);
  const getStoreById = (id) => appData.stores.find((s) => s.id === id);
  const getListingById = (id) => appData.listings.find((l) => l.id === id);
  const getCartForUser = (userId) => {
    let cart = appData.carts.find((c) => c.userId === userId);
    if (!cart) {
      cart = { userId, items: [] };
      appData.carts.push(cart);
      saveAppData();
    }
    return cart;
  };
  const addToCart = (userId, listingId, quantity = 1) => {
    const qty = Math.max(1, Number(quantity) || 1);
    const cart = getCartForUser(userId);
    const existing = cart.items.find((i) => i.listingId === listingId);
    if (existing) {
      existing.quantity += qty;
    } else {
      cart.items.push({ listingId, quantity: qty });
    }
    saveAppData();
  };
  const getAdminUser = () => appData.users.find((u) => u.role === "admin");

  const computeAverageRating = (listingId) => {
    const recs = appData.comments.filter((c) => c.listingId === listingId);
    if (!recs.length) return null;
    const avg = recs.reduce((s, c) => s + c.rating, 0) / recs.length;
    return avg.toFixed(1);
  };
  const computeStoreAverageRating = (storeId) => {
    const lst = appData.listings.filter((l) => l.storeId === storeId);
    const ratings = lst
      .map((l) => parseFloat(computeAverageRating(l.id)))
      .filter((v) => !isNaN(v));
    if (!ratings.length) return null;
    const avg = ratings.reduce((s, v) => s + v, 0) / ratings.length;
    return avg.toFixed(1);
  };

  /* ------------------- UI Helper ------------------- */
  function setMainHTML(html) {
    $("#main-content").innerHTML = html;
  }
  function getActiveSection() {
    const hash = location.hash || "#login";
    if (hash.startsWith("#admin")) return "admin";
    if (hash.startsWith("#seller")) return "seller";
    if (hash.startsWith("#buyer")) return "buyer";
    if (hash.startsWith("#catalog") || hash.startsWith("#listing")) return "catalog";
    if (hash.startsWith("#messages") || hash.startsWith("#chat")) return "messages";
    if (hash.startsWith("#cart")) return "cart";
    if (hash.startsWith("#order")) return "order";
    if (hash.startsWith("#login")) return "login";
    if (hash.startsWith("#register")) return "register";
    return "";
  }
  function goBack(fallbackHash = null) {
    if (window.history.length > 1) {
      window.history.back();
    } else if (fallbackHash) {
      location.hash = fallbackHash;
    } else {
      const u = getCurrentUser();
      redirectHome(u);
    }
  }

  /* ------------------- Navigation Bar ------------------- */
  function renderNavBar() {
    const nav = $("#nav-bar");
    const user = getCurrentUser();
    let html = "";

    if (!user) {
      html = `<a href="#login">Login</a>
              <a href="#register">Register</a>`;
    } else {
      if (user.role === "admin") html += `<a href="#admin">Admin</a>`;
      if (user.role === "seller") html += `<a href="#seller">Seller</a>`;
      if (user.role === "buyer") html += `<a href="#buyer">Buyer</a>`;

      html += `<a href="#catalog">Catalog</a>`;

      // Cart badge (buyer only)
      if (user.role === "buyer") {
        const cartCount = getCartForUser(user.id).items.reduce((s,i)=>s+i.quantity,0);
        html += `<a href="#cart">Cart (${cartCount})</a>`;
      }

      // Messaging badge (all logged‑in users)
      const unread = appData.messages.filter(m=>m.toId===user.id && !m.read).length;
      html += `<a href="#messages">Messages${unread?" ("+unread+")":""}</a>`;

      html += `<a href="#" id="logout-link">Logout</a>`;
    }
    nav.innerHTML = html;

    $("#logout-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });

    // Active state indicator
    const active = getActiveSection();
    $$("nav a").forEach((link) => {
      const href = link.getAttribute("href") || "";
      const section =
        href.includes("#admin") ? "admin" :
        href.includes("#seller") ? "seller" :
        href.includes("#buyer") ? "buyer" :
        href.includes("#catalog") ? "catalog" :
        href.includes("#messages") ? "messages" :
        href.includes("#cart") ? "cart" :
        href.includes("#login") ? "login" :
        href.includes("#register") ? "register" : "";
      if (section && section === active) {
        link.classList.add("active");
      }
    });
  }

  /* ------------------- Routing ------------------- */
  function route() {
    renderNavBar();
    const hash = location.hash || "#login";
    const user = getCurrentUser();

    // Public pages
    if (hash.startsWith("#login")) return renderLoginPage();
    if (hash.startsWith("#register")) return renderRegisterPage();

    // Must be logged in for the rest
    if (!user) {
      location.hash = "#login";
      return;
    }

    // Role‑specific home pages
    if (hash.startsWith("#admin")) {
      if (user.role !== "admin") return redirectHome(user);
      return renderAdminDashboard();
    }
    if (hash.startsWith("#seller")) {
      if (user.role !== "seller") return redirectHome(user);
      return renderSellerDashboard();
    }
    if (hash.startsWith("#buyer")) {
      if (user.role !== "buyer") return redirectHome(user);
      return renderBuyerDashboard();
    }

    // Shared pages
    if (hash.startsWith("#catalog")) return renderCatalogPage();
    if (hash.startsWith("#listing/")) {
      const id = hash.split("/")[1];
      return renderListingDetail(id);
    }
    if (hash.startsWith("#order/")) {
      const id = hash.split("/")[1];
      return renderOrderDetail(id);
    }
    if (hash.startsWith("#cart")) return renderCartPage();
    if (hash.startsWith("#messages")) return renderMessagesPage();
    if (hash.startsWith("#chat/")) {
      const otherId = hash.split("/")[1];
      return renderChatPage(otherId);
    }

    // Unknown – bounce to role home
    redirectHome(user);
  }

  function redirectHome(user) {
    if (!user) location.hash = "#login";
    else if (user.role === "admin") location.hash = "#admin";
    else if (user.role === "seller") location.hash = "#seller";
    else location.hash = "#buyer";
  }

  window.addEventListener("hashchange", route);
  window.addEventListener("DOMContentLoaded", () => {
    renderNavBar();
    route();

    // Autosave safety net to keep all changes persistent
    const AUTO_SAVE_INTERVAL_MS = 5000;
    setInterval(saveAppData, AUTO_SAVE_INTERVAL_MS);
    window.addEventListener("beforeunload", saveAppData);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) saveAppData();
    });
  });

  /* -------------------------------------------------
     Page Renderers (Login, Register, Admin, Seller, Buyer)
     ------------------------------------------------- */

  /* ----- Login ----- */
  function renderLoginPage() {
    const html = `
      <h2>Login</h2>
      <form id="login-form">
        <label>Username
          <input type="text" name="username" required>
        </label>
        <label>Password
          <input type="password" name="password" required>
        </label>
        <button type="submit">Login</button>
      </form>
      <p>Don’t have an account? <a href="#register">Register here</a></p>
    `;
    setMainHTML(html);
    $("#login-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const u = e.target.username.value.trim();
      const p = e.target.password.value;
      const user = appData.users.find((usr) => usr.username === u && usr.password === p);
      if (user) {
        setCurrentUser(user.id);
        renderNavBar();
        redirectHome(user);
      } else {
        showMessage("Invalid username or password.");
      }
    });
  }

  /* ----- Register ----- */
  function renderRegisterPage() {
    const html = `
      <h2>Register</h2>
      <form id="register-form">
        <label>Username
          <input type="text" name="username" required>
        </label>
        <label>Password
          <input type="password" name="password" required>
        </label>
        <label>Role
          <select name="role" required>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
          </select>
        </label>
        <button type="submit">Create Account</button>
      </form>
      <p>Already have an account? <a href="#login">Login here</a></p>
    `;
    setMainHTML(html);
    $("#register-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const username = e.target.username.value.trim();
      const password = e.target.password.value;
      const role = e.target.role.value;
      if (appData.users.some((u) => u.username === username)) {
        showMessage("Username already taken.");
        return;
      }
      appData.users.push({
        id: generateId(),
        username,
        password,
        role,
        storeId: null
      });
      saveAppData();
      showMessage("Account created – you can now log in.");
      location.hash = "#login";
    });
  }

  /* ----- Admin Dashboard ----- */
  function renderAdminDashboard() {
    const userCount = appData.users.length;
    const storeCount = appData.stores.length;
    const listingCount = appData.listings.length;
    const orderCount = appData.orders.length;
    const commentCount = appData.comments.length;
    const messageCount = appData.messages.length;

    const buildTable = (headers, rows) => {
      const thead = "<tr>" + headers.map((h) => `<th>${h}</th>`).join("") + "</tr>";
      const tbody = rows
        .map(
          (r) =>
            "<tr>" +
            headers
              .map((h) => `<td>${r[h] !== undefined ? r[h] : ""}</td>`)
              .join("") +
            "</tr>"
        )
        .join("");
      return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
    };

    const userRows = appData.users.map((u) => ({
      ID: u.id,
      Username: u.username,
      Role: u.role
    }));
    const storeRows = appData.stores.map((s) => ({
      ID: s.id,
      Name: s.name,
      Owner: getUserById(s.sellerId).username
    }));
    const listingRows = appData.listings.map((l) => ({
      ID: l.id,
      Title: l.title,
      Type: l.type,
      Price: formatPrice(l.price),
      Store: getStoreById(l.storeId).name
    }));
    const orderRows = appData.orders.map((o) => ({
      ID: o.id,
      Buyer: getUserById(o.buyerId).username,
      Store: getStoreById(o.storeId).name,
      Listing: getListingById(o.listingId).title,
      Qty: o.quantity,
      Status: o.status
    }));
    const commentRows = appData.comments.map((c) => ({
      ID: c.id,
      Listing: getListingById(c.listingId).title,
      Buyer: getUserById(c.buyerId).username,
      Rating: c.rating,
      Text: c.text
    }));
    const messageRows = appData.messages.map((m) => ({
      ID: m.id,
      From: getUserById(m.fromId).username,
      To: getUserById(m.toId).username,
      Subject: m.subject || "(no subject)",
      Date: new Date(m.timestamp).toLocaleString(),
      Read: m.read ? "✔" : "✖"
    }));

    const html = `
      <div class="page-header">
        <h2>Admin Dashboard</h2>
        <span class="spacer"></span>
        <button id="admin-compose-btn">New Message</button>
      </div>
      <section>
        <p><strong>Users:</strong> ${userCount}</p>
        <p><strong>Stores:</strong> ${storeCount}</p>
        <p><strong>Listings:</strong> ${listingCount}</p>
        <p><strong>Orders:</strong> ${orderCount}</p>
        <p><strong>Comments:</strong> ${commentCount}</p>
        <p><strong>Messages:</strong> ${messageCount}</p>
      </section>

      <details open><summary>All Users</summary>
        ${buildTable(["ID","Username","Role"],userRows)}
      </details>

      <details><summary>All Stores</summary>
        ${buildTable(["ID","Name","Owner"],storeRows)}
      </details>

      <details><summary>All Listings</summary>
        ${buildTable(["ID","Title","Type","Price","Store"],listingRows)}
      </details>

      <details><summary>All Orders</summary>
        ${buildTable(["ID","Buyer","Store","Listing","Qty","Status"],orderRows)}
      </details>

      <details><summary>All Comments / Ratings</summary>
        ${buildTable(["ID","Listing","Buyer","Rating","Text"],commentRows)}
      </details>

      <details><summary>All Messages</summary>
        ${buildTable(["ID","From","To","Subject","Date","Read"],messageRows)}
      </details>
    `;
    setMainHTML(html);
    $("#admin-compose-btn")?.addEventListener("click", () => renderSendMessagePage());
  }

  /* ----- Seller Dashboard ----- */
  function renderSellerDashboard() {
    const user = getCurrentUser();

    /* --- Store creation (if missing) --- */
    let store = appData.stores.find((s) => s.sellerId === user.id);
    if (!store) {
      const html = `
        <h2>Seller Dashboard – Create Your Store</h2>
        <form id="store-create-form">
          <label>Store Name
            <input type="text" name="name" required>
          </label>
          <label>Store Description
            <textarea name="description" rows="3"></textarea>
          </label>

          <label>Store Image (upload or URL)
            <input type="file" name="storeImageFile" accept="image/*">
            <input type="url" name="imageUrl" placeholder="Or paste image URL">
            <div id="store-image-preview"></div>
          </label>

          <button type="submit">Create Store</button>
        </form>
      `;
      setMainHTML(html);

      // ---- Image handling (store) ----
      let uploadedImg = null;
      const fileInp = $("#store-create-form input[name='storeImageFile']");
      const previewDiv = $("#store-image-preview");
      const urlInp = $("#store-create-form input[name='imageUrl']");

      fileInp.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            uploadedImg = ev.target.result;
            previewDiv.innerHTML = `<img src="${uploadedImg}"
                                      alt="preview"
                                      style="max-width:200px;max-height:200px;">`;
          };
          reader.readAsDataURL(file);
        }
      });
      urlInp.addEventListener("input", (e) => {
        const url = e.target.value.trim();
        if (url) {
          previewDiv.innerHTML = `<img src="${url}" alt="preview"
                                    style="max-width:200px;max-height:200px;">`;
        } else if (uploadedImg) {
          previewDiv.innerHTML = `<img src="${uploadedImg}" alt="preview"
                                    style="max-width:200px;max-height:200px;">`;
        } else {
          previewDiv.innerHTML = "";
        }
      });

      // ---- Submit store creation ----
      $("#store-create-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = e.target.name.value.trim();
        const description = e.target.description.value.trim();
        const imageUrl = uploadedImg ||
                         e.target.imageUrl.value.trim() ||
                         null;
        const newStore = {
          id: generateId(),
          sellerId: user.id,
          name,
          description,
          imageUrl
        };
        appData.stores.push(newStore);
        saveAppData();
        showToast("Store created!", "success");
        renderSellerDashboard();
      });
      return; // stop further rendering until store exists
    }

    /* --- Main seller view --- */
    const storeListings = appData.listings.filter((l) => l.storeId === store.id);
    const storeOrders = appData.orders.filter((o) => o.storeId === store.id);

    const avgRating = (listingId) => {
      const avg = computeAverageRating(listingId);
      return avg ? `${avg} ★` : "No rating";
    };

    const html = `
      <h2>Seller Dashboard – ${escapeHtml(store.name)}</h2>

      <section class="store-info">
        ${store.imageUrl ? `<img src="${store.imageUrl}" alt="Store image"
                                 style="max-width:250px;max-height:250px;">` : ""}
        <p><strong>Description:</strong> ${escapeHtml(store.description || "-")}</p>
        <p><strong>Average Rating (all listings):</strong>
           ${computeStoreAverageRating(store.id) || "No ratings"}
        </p>
        <button id="edit-store-btn">Edit Store</button>
        <button id="compose-message-btn">Send Message</button>
      </section>

      <section class="listings">
        <h3>Your Listings (${storeListings.length})</h3>
        <button id="add-listing-btn">Add New Listing</button>
        <div class="grid">
          ${storeListings
            .map(
              (l) => `
                <div class="card">
                  <img src="${l.imageUrl ||
                    "https://via.placeholder.com/300x150?text=No+Image"}"
                       alt="listing">
                  <div class="info">
                    <h3>${escapeHtml(l.title)}</h3>
                    <p><strong>Type:</strong> ${escapeHtml(l.type)}</p>
                    <p><strong>Price:</strong> ${formatPrice(l.price)}</p>
                    <p><strong>Rating:</strong> ${avgRating(l.id)}</p>
                  </div>
                  <div class="actions">
                    <button class="edit-listing" data-id="${l.id}">Edit</button>
                    <button class="del-listing" data-id="${l.id}">Delete</button>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </section>

      <section class="orders">
        <h3>Orders for Your Store (${storeOrders.length})</h3>
        ${
          storeOrders.length
            ? `<table>
                <thead>
                  <tr><th>Order ID</th><th>Buyer</th><th>Listing</th>
                      <th>Qty</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  ${storeOrders
                    .map(
                      (o) => `
                        <tr>
                          <td>${o.id}</td>
                          <td>${escapeHtml(getUserById(o.buyerId).username)}</td>
                          <td>${escapeHtml(getListingById(o.listingId).title)}</td>
                  <td>${o.quantity}</td>
                  <td>${o.status}</td>
                  <td class="order-action" data-id="${o.id}">
                    ${o.status === "pending"
                      ? `<button class="order-status"
                                 data-id="${o.id}"
                                 data-new="completed">
                           Mark as Completed
                         </button>`
                      : `<span class="status-pill done">Completed</span>`}
                  </td>
                        </tr>
                      `
                    )
                    .join("")}
                </tbody>
              </table>`
            : "<p>No orders yet.</p>"
        }
      </section>
    `;
    setMainHTML(html);

    // ----- Store edit -----
    $("#edit-store-btn").addEventListener("click", () => {
      const html = `
        <div class="page-header">
          <button id="back-btn" class="back-btn">← Back</button>
          <h3>Edit Store – ${escapeHtml(store.name)}</h3>
        </div>
        <form id="store-edit-form">
          <label>Name
            <input type="text" name="name"
                   value="${escapeHtml(store.name)}" required>
          </label>
          <label>Description
            <textarea name="description" rows="3">${escapeHtml(store.description)}</textarea>
          </label>

          <label>Store Image (upload or URL)
            <input type="file" name="storeImageFile" accept="image/*">
            <input type="url" name="imageUrl"
                   placeholder="Or paste image URL"
                   value="${store.imageUrl || ""}">
            <div id="store-image-preview">${
              store.imageUrl
                ? `<img src="${store.imageUrl}" alt="preview"
                        style="max-width:200px;max-height:200px;">`
                : ""
            }</div>
          </label>

          <button type="submit">Save Changes</button>
          <button type="button" id="cancel-store-edit">Cancel</button>
        </form>
      `;
      setMainHTML(html);
      $("#back-btn")?.addEventListener("click", () => goBack("#seller"));

      // ---- Image handling (edit) ----
      let uploadedImg = null;
      const fileInp = $("#store-edit-form input[name='storeImageFile']");
      const previewDiv = $("#store-image-preview");
      const urlInp = $("#store-edit-form input[name='imageUrl']");

      fileInp.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            uploadedImg = ev.target.result;
            previewDiv.innerHTML = `<img src="${uploadedImg}" alt="preview"
                                      style="max-width:200px;max-height:200px;">`;
          };
          reader.readAsDataURL(file);
        }
      });
      urlInp.addEventListener("input", (e) => {
        const url = e.target.value.trim();
        if (url) {
          previewDiv.innerHTML = `<img src="${url}" alt="preview"
                                    style="max-width:200px;max-height:200px;">`;
        } else if (uploadedImg) {
          previewDiv.innerHTML = `<img src="${uploadedImg}" alt="preview"
                                    style="max-width:200px;max-height:200px;">`;
        } else {
          previewDiv.innerHTML = "";
        }
      });

      // ---- Submit edit ----
      $("#store-edit-form").addEventListener("submit", (e) => {
        e.preventDefault();
        store.name = e.target.name.value.trim();
        store.description = e.target.description.value.trim();
        store.imageUrl = uploadedImg ||
                         e.target.imageUrl.value.trim() ||
                         null;
        saveAppData();
        showToast("Store updated!", "success");
        renderSellerDashboard();
      });
      $("#cancel-store-edit").addEventListener("click", renderSellerDashboard);
    });

    // ----- Listing actions -----
    $("#add-listing-btn").addEventListener("click", () => {
      renderListingForm(null, store.id);
    });
    $$(".edit-listing").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        renderListingForm(id, store.id);
      });
    });
    $$(".del-listing").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (confirm("Delete this listing?")) {
          const idx = appData.listings.findIndex((l) => l.id === id);
          if (idx >= 0) {
            appData.listings.splice(idx, 1);
            // Clean up related orders/comments
            appData.orders = appData.orders.filter((o) => o.listingId !== id);
            appData.comments = appData.comments.filter((c) => c.listingId !== id);
            saveAppData();
            showToast("Listing deleted.", "info");
            renderSellerDashboard();
          }
        }
      });
    });

    // ----- Order status toggle (one-way to completed) -----
    $$(".order-status").forEach((btn) => {
      btn.addEventListener("click", () => {
        const orderId = btn.dataset.id;
        const order = appData.orders.find((o) => o.id === orderId);
        if (order && order.status === "pending") {
          order.status = "completed";

          // Update UI: change status text and replace button with badge
          const row = btn.closest("tr");
          const statusCell = row?.querySelector("td:nth-child(5)");
          if (statusCell) statusCell.textContent = "completed";
          const actionCell = row?.querySelector("td.order-action");
          if (actionCell) actionCell.innerHTML = `<span class="status-pill done">Completed</span>`;

          // Notify buyer about status change
          const buyerId = order.buyerId;
          createMessage(user.id, buyerId,
            "Order Status Update",
            `Your order #${order.id} is now ${order.status}.`);
          saveAppData();
          showToast("Order marked as completed.", "success");
        }
      });
    });

    // ----- Messaging -----
    $("#compose-message-btn").addEventListener("click", () => renderSendMessagePage());
  }

  /* ----- Listing Form (Create / Edit) ----- */
  function renderListingForm(listingId, storeId) {
    const isEdit = Boolean(listingId);
    const listing = isEdit ? getListingById(listingId) : null;
    const existingImg = listing ? listing.imageUrl : null;

    const html = `
      <div class="page-header">
        <button id="back-btn" class="back-btn">← Back</button>
        <h3>${isEdit ? "Edit" : "Add"} Listing</h3>
      </div>
      <form id="listing-form">
        <label>Title
          <input type="text" name="title"
                 value="${listing ? escapeHtml(listing.title) : ""}" required>
        </label>
        <label>Description
          <textarea name="description" rows="3" required>${listing ? escapeHtml(listing.description) : ""}</textarea>
        </label>
        <label>Price (${CURRENCY})
          <input type="number" name="price" min="0" step="1"
                 value="${listing ? listing.price : ""}" required>
        </label>
        <label>Type
          <select name="type" required>
            <option value="product" ${
              listing && listing.type === "product" ? "selected" : ""
            }>Product</option>
            <option value="service" ${
              listing && listing.type === "service" ? "selected" : ""
            }>Service</option>
            <option value="rental" ${
              listing && listing.type === "rental" ? "selected" : ""
            }>Rental</option>
          </select>
        </label>

        <label>Image (upload a file or paste URL)
          <input type="file" name="imageFile" accept="image/*">
          <input type="url" name="imageUrl"
                 placeholder="Or paste image URL"
                 value="${listing ? listing.imageUrl || "" : ""}">
          <div id="image-preview">${
            existingImg
              ? `<img src="${existingImg}"
                      alt="preview"
                      style="max-width:200px;max-height:200px;">`
              : ""
          }</div>
        </label>

        <button type="submit">${isEdit ? "Save Changes" : "Create Listing"}</button>
        <button type="button" id="cancel-listing">Cancel</button>
      </form>
    `;
    setMainHTML(html);
    $("#back-btn")?.addEventListener("click", () => goBack("#seller"));

    // ---- Image handling ----
    let uploadedImg = null;
    const fileInp = $("#listing-form input[name='imageFile']");
    const previewDiv = $("#image-preview");
    const urlInp = $("#listing-form input[name='imageUrl']");

    fileInp.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          uploadedImg = ev.target.result;
          previewDiv.innerHTML = `<img src="${uploadedImg}" alt="preview"
                                    style="max-width:200px;max-height:200px;">`;
        };
        reader.readAsDataURL(file);
      }
    });
    urlInp.addEventListener("input", (e) => {
      const url = e.target.value.trim();
      if (url) {
        previewDiv.innerHTML = `<img src="${url}" alt="preview"
                                  style="max-width:200px;max-height:200px;">`;
      } else if (uploadedImg) {
        previewDiv.innerHTML = `<img src="${uploadedImg}" alt="preview"
                                  style="max-width:200px;max-height:200px;">`;
      } else {
        previewDiv.innerHTML = "";
      }
    });

    // ---- Submit ----
    $("#listing-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const data = {
        title: e.target.title.value.trim(),
        description: e.target.description.value.trim(),
        price: parseInt(e.target.price.value, 10),
        type: e.target.type.value,
        imageUrl: uploadedImg || e.target.imageUrl.value.trim() || null,
        storeId
      };
      if (isEdit) {
        Object.assign(listing, data);
        showToast("Listing updated!", "success");
      } else {
        const newListing = {
          id: generateId(),
          ...data,
          createdAt: now()
        };
        appData.listings.push(newListing);
        showToast("Listing created!", "success");
      }
      saveAppData();
      renderSellerDashboard();
    });

    $("#cancel-listing").addEventListener("click", renderSellerDashboard);
  }

  /* ----- Buyer Dashboard ----- */
  function renderBuyerDashboard() {
    const user = getCurrentUser();
    const orders = appData.orders.filter((o) => o.buyerId === user.id);

    const html = `
      <h2>Buyer Dashboard – ${escapeHtml(user.username)}</h2>

      <section class="my-orders">
        <h3>Your Orders (${orders.length})</h3>
        ${
          orders.length
            ? `<table>
                <thead>
                  <tr><th>Order ID</th><th>Store</th><th>Listing</th>
                      <th>Qty</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  ${orders
                    .map(
                      (o) => `
                        <tr>
                          <td>${o.id}</td>
                          <td>${escapeHtml(getStoreById(o.storeId).name)}</td>
                          <td>${escapeHtml(getListingById(o.listingId).title)}</td>
                          <td>${o.quantity}</td>
                          <td>${o.status}</td>
                          <td>
                            ${
                              o.status === "pending"
                                ? `<button class="cancel-order"
                                         data-id="${o.id}">Cancel</button>`
                                : ""
                            }
                            ${
                              !hasUserCommentedOnOrder(user.id, o.id)
                                ? `<button class="review-order"
                                         data-id="${o.id}">Add Review</button>`
                                : ""
                            }
                            <a href="#order/${o.id}">Details</a>
                          </td>
                        </tr>
                      `
                    )
                    .join("")}
                </tbody>
              </table>`
            : "<p>You have not placed any orders yet.</p>"
        }
      </section>

      <section class="messages">
        <h3>Messages</h3>
        <button id="compose-message-btn">New Message</button>
      </section>

      <section class="catalog-link">
        <p>Ready to shop? <a href="#catalog">Browse the marketplace</a></p>
      </section>
    `;
    setMainHTML(html);

    // Cancel order
    $$(".cancel-order").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const order = appData.orders.find((o) => o.id === id);
        if (order && order.status === "pending") {
          if (confirm("Cancel this order?")) {
            order.status = "canceled";

            // Notify seller about cancellation
            const sellerId = getStoreById(order.storeId).sellerId;
            createMessage(user.id, sellerId,
              "Order Cancelled",
              `Buyer cancelled order #${order.id}.`);

            saveAppData();
            showToast("Order cancelled.", "info");
            renderBuyerDashboard();
          }
        }
      });
    });

    // Add review (after order)
    $$(".review-order").forEach((btn) => {
      btn.addEventListener("click", () => {
        const oid = btn.dataset.id;
        renderReviewForm(oid);
      });
    });

    // New message
    $("#compose-message-btn").addEventListener("click", () => renderSendMessagePage());
  }

  /* ----- Review form (buyer) ----- */
  function renderReviewForm(orderId) {
    const order = appData.orders.find((o) => o.id === orderId);
    if (!order) {
      showMessage("Order not found.");
      renderBuyerDashboard();
      return;
    }
    const listing = getListingById(order.listingId);
    const html = `
      <h3>Leave a Review for ${escapeHtml(listing.title)}</h3>
      <form id="review-form">
        <label>Rating (1‑5)
          <select name="rating" required>
            <option value="">Select</option>
            <option value="1">1 ★</option>
            <option value="2">2 ★★</option>
            <option value="3">3 ★★★</option>
            <option value="4">4 ★★★★</option>
            <option value="5">5 ★★★★★</option>
          </select>
        </label>
        <label>Comment (optional)
          <textarea name="text" rows="3"></textarea>
        </label>
        <button type="submit">Submit Review</button>
        <button type="button" id="cancel-review">Cancel</button>
      </form>
    `;
    setMainHTML(html);
    $("#review-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const rating = parseInt(e.target.rating.value, 10);
      const txt = e.target.text.value.trim();
      const buyer = getCurrentUser();

      appData.comments.push({
        id: generateId(),
        listingId: listing.id,
        buyerId: buyer.id,
        rating,
        text: txt,
        createdAt: now()
      });
      saveAppData();

      // Notify store owner and admin
      const storeOwnerId = getStoreById(listing.storeId).sellerId;
      createMessage(buyer.id, storeOwnerId,
        "New Review",
        `You received a new review on "${listing.title}".`);
      const admin = getAdminUser();
      if (admin) createMessage(buyer.id, admin.id,
        "New Review",
        `Buyer reviewed "${listing.title}".`);

      showToast("Thank you for your review!", "success");
      renderBuyerDashboard();
    });
    $("#cancel-review").addEventListener("click", renderBuyerDashboard);
  }

  function hasUserCommentedOnOrder(buyerId, orderId) {
    const order = appData.orders.find((o) => o.id === orderId);
    return order
      ? appData.comments.some(
          (c) => c.listingId === order.listingId && c.buyerId === buyerId
        )
      : false;
  }

  /* ----- Catalog (search, filter, add‑to‑cart) ----- */
  function renderCatalogPage() {
    const user = getCurrentUser();

    const typeFromHash = (() => {
      const match = location.hash.match(/\?type=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : "all";
    })();

    const html = `
      <h2>Marketplace Catalog</h2>

      <div class="search-bar">
        <input type="search" id="search-input" placeholder="Search listings..."/>
      </div>

      <div class="filter-bar">
        <label>Filter by type:
          <select id="type-filter">
            <option value="all"${typeFromHash === "all" ? " selected" : ""}>All</option>
            <option value="product"${typeFromHash === "product" ? " selected" : ""}>Product</option>
            <option value="service"${typeFromHash === "service" ? " selected" : ""}>Service</option>
            <option value="rental"${typeFromHash === "rental" ? " selected" : ""}>Rental</option>
          </select>
        </label>
      </div>

      <div class="grid" id="catalog-cards"></div>
    `;
    setMainHTML(html);

    const renderCards = (searchTerm = "", typeFilter = "all") => {
      const term = searchTerm.trim().toLowerCase();
      const filtered = appData.listings.filter((l) => {
        const matchesType = typeFilter === "all" ? true : l.type === typeFilter;
        const matchesSearch = !term ||
          l.title.toLowerCase().includes(term) ||
          l.description.toLowerCase().includes(term);
        return matchesType && matchesSearch;
      });

      const container = $("#catalog-cards");
      if (!filtered.length) {
        container.innerHTML = "<p>No listings found.</p>";
        return;
      }

      container.innerHTML = filtered.map((l) => {
        const avg = computeAverageRating(l.id);
        const ratingTxt = avg ? `${avg} ★` : "No rating";
        const addBtn = (user && user.role === "buyer")
          ? `<button class="add-to-cart" data-id="${l.id}">Add to Cart</button>`
          : "";
        return `
          <div class="card">
            <img src="${l.imageUrl ||
              "https://via.placeholder.com/300x150?text=No+Image"}"
                 alt="listing">
            <div class="info">
              <h3>${escapeHtml(l.title)}</h3>
              <p>${escapeHtml(l.description)}</p>
              <p><strong>Type:</strong> ${escapeHtml(l.type)}</p>
              <p><strong>Price:</strong> ${formatPrice(l.price)}</p>
              <p><strong>Rating:</strong> ${ratingTxt}</p>
            </div>
            <div class="actions">
              <button class="view-details" data-id="${l.id}">View</button>
              ${addBtn}
            </div>
          </div>
        `;
      }).join("");

      // Detail view
      $$(".view-details").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          location.hash = `#listing/${id}`;
        });
      });
      // Add to cart
      $$(".add-to-cart").forEach((btn) => {
        btn.addEventListener("click", () => {
          const listingId = btn.dataset.id;
          if (!user) {
            showToast("Please log in first.", "danger");
            location.hash = "#login";
            return;
          }
          addToCart(user.id, listingId, 1);
          showToast("Item added to cart.", "success");
          renderNavBar(); // update cart badge
        });
      });
    };

    // Initial render
    renderCards("", typeFromHash);

    // Filter change
    $("#type-filter").addEventListener("change", (e) => {
      const t = e.target.value;
      const s = $("#search-input").value;
      renderCards(s, t);
      location.hash = t === "all" ? "#catalog" : `#catalog?type=${t}`;
    });

    // Search input
    $("#search-input").addEventListener("input", () => {
      const s = $("#search-input").value;
      const t = $("#type-filter").value;
      renderCards(s, t);
    });
  }

  /* ----- Listing Detail ----- */
  function renderListingDetail(listingId) {
    const listing = getListingById(listingId);
    if (!listing) {
      setMainHTML("<p>Listing not found.</p>");
      return;
    }
    const store = getStoreById(listing.storeId);
    const avg = computeAverageRating(listing.id);
    const commentsHtml = appData.comments
      .filter((c) => c.listingId === listing.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(
        (c) => `
          <div class="comment">
            <p><strong>${escapeHtml(getUserById(c.buyerId).username)}</strong> – ${c.rating} ★</p>
            <p>${escapeHtml(c.text)}</p>
          </div>
        `
      )
      .join("");

    const curUser = getCurrentUser();
    const canAddToCart = curUser && curUser.role === "buyer";

    const html = `
      <div class="page-header">
        <button id="back-btn" class="back-btn">← Back</button>
        <h2>${escapeHtml(listing.title)}</h2>
      </div>
      <div class="listing-detail">
        <img src="${listing.imageUrl ||
          "https://via.placeholder.com/600x300?text=No+Image"}"
             alt="listing" style="max-width:100%;height:auto;">
        <p><strong>Type:</strong> ${escapeHtml(listing.type)}</p>
        <p><strong>Price:</strong> ${formatPrice(listing.price)}</p>
        <p><strong>Store:</strong> ${escapeHtml(store.name)}</p>
        <p><strong>Description:</strong> ${escapeHtml(listing.description)}</p>
        <p><strong>Average Rating:</strong> ${avg ? `${avg} ★` : "No rating yet"}</p>

        <button id="order-btn">Place Order</button>
        ${canAddToCart ? `<button id="add-to-cart-btn">Add to Cart</button>` : ""}
        <button id="back-to-catalog">Back to catalog</button>

        <hr>
        <h3>Comments</h3>
        ${commentsHtml || "<p>No comments yet.</p>"}
        ${
          curUser && curUser.role === "buyer"
            ? `<button id="add-review-btn">Leave a Review</button>`
            : ""
        }
        ${
          curUser
            ? `<button id="message-seller-btn">Message Seller</button>`
            : ""
        }
      </div>
    `;
    setMainHTML(html);
    $("#back-btn")?.addEventListener("click", () => goBack("#catalog"));

    // Order
    $("#order-btn").addEventListener("click", () => {
      const cur = getCurrentUser();
      if (!cur) {
        showToast("Please log in to order.", "danger");
        location.hash = "#login";
        return;
      }
      if (cur.role !== "buyer") {
        showToast("Only buyers can place orders.", "danger");
        return;
      }
      renderOrderForm(listing);
    });

    // Add to cart
    $("#add-to-cart-btn")?.addEventListener("click", () => {
      const cur = getCurrentUser();
      if (!cur) {
        showToast("Please log in first.", "danger");
        location.hash = "#login";
        return;
      }
      addToCart(cur.id, listing.id, 1);
      showToast("Item added to cart.", "success");
      renderNavBar();
    });

    // Review
    $("#add-review-btn")?.addEventListener("click", () => {
      renderListingReviewForm(listing);
    });

    // Message seller (buyer)
    $("#message-seller-btn")?.addEventListener("click", () => {
      renderSendMessagePage(store.sellerId);
    });

    // Back
    $("#back-to-catalog").addEventListener("click", () => {
      const hash = location.hash;
      if (hash.includes("?")) {
        location.hash = "#catalog" + hash.substring(hash.indexOf("?"));
      } else {
        location.hash = "#catalog";
      }
    });
  }

  /* ----- Review from listing page (buyer) ----- */
  function renderListingReviewForm(listing) {
    const html = `
      <h3>Leave a Review for ${escapeHtml(listing.title)}</h3>
      <form id="listing-review-form">
        <label>Rating (1‑5)
          <select name="rating" required>
            <option value="">Select</option>
            <option value="1">1 ★</option>
            <option value="2">2 ★★</option>
            <option value="3">3 ★★★</option>
            <option value="4">4 ★★★★</option>
            <option value="5">5 ★★★★★</option>
          </select>
        </label>
        <label>Comment (optional)
          <textarea name="text" rows="3"></textarea>
        </label>
        <button type="submit">Submit Review</button>
        <button type="button" id="cancel-listing-review">Cancel</button>
      </form>
    `;
    setMainHTML(html);
    $("#listing-review-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const rating = parseInt(e.target.rating.value, 10);
      const txt = e.target.text.value.trim();
      const buyer = getCurrentUser();

      appData.comments.push({
        id: generateId(),
        listingId: listing.id,
        buyerId: buyer.id,
        rating,
        text: txt,
        createdAt: now()
      });
      saveAppData();

      // Notify store owner + admin
      const storeOwnerId = getStoreById(listing.storeId).sellerId;
      createMessage(buyer.id, storeOwnerId,
        "New Review",
        `You received a new review on "${listing.title}".`);
      const admin = getAdminUser();
      if (admin) createMessage(buyer.id, admin.id,
        "New Review",
        `Buyer reviewed "${listing.title}".`);

      showToast("Thank you for your review!", "success");
      location.hash = `#listing/${listing.id}`;
    });
    $("#cancel-listing-review").addEventListener("click", () => {
      location.hash = `#listing/${listing.id}`;
    });
  }

  /* ----- Order Form (buyer) ----- */
  function renderOrderForm(listing) {
    const html = `
      <h3>Place Order – ${escapeHtml(listing.title)}</h3>
      <form id="order-form">
        <label>Quantity
          <input type="number" name="quantity" min="1" value="1" required>
        </label>
        <label>Notes (optional)
          <textarea name="notes" rows="2"></textarea>
        </label>
        <button type="submit">Confirm Order</button>
        <button type="button" id="cancel-order">Cancel</button>
      </form>
    `;
    setMainHTML(html);
    $("#order-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const qty = parseInt(e.target.quantity.value, 10);
      const notes = e.target.notes.value.trim();
      const buyer = getCurrentUser();

      const order = {
        id: generateId(),
        buyerId: buyer.id,
        storeId: listing.storeId,
        listingId: listing.id,
        quantity: qty,
        notes,
        status: "pending",
        createdAt: now()
      };
      appData.orders.push(order);
      saveAppData();

      // Notify seller + admin
      const sellerId = getStoreById(listing.storeId).sellerId;
      createMessage(buyer.id, sellerId,
        "New Order",
        `Order #${order.id} placed for "${listing.title}".`);
      const admin = getAdminUser();
      if (admin) createMessage(buyer.id, admin.id,
        "New Order",
        `Buyer placed order #${order.id} for "${listing.title}".`);

      showToast("Order placed successfully!", "success");
      location.hash = "#buyer";
    });
    $("#cancel-order").addEventListener("click", () => {
      location.hash = `#listing/${listing.id}`;
    });
  }

  /* ----- Order Detail (any role) ----- */
  function renderOrderDetail(orderId) {
    const order = appData.orders.find((o) => o.id === orderId);
    if (!order) {
      setMainHTML("<p>Order not found.</p>");
      return;
    }
    const buyer = getUserById(order.buyerId);
    const listing = getListingById(order.listingId);
    const store = getStoreById(order.storeId);

    const html = `
      <div class="page-header">
        <button id="back-btn" class="back-btn">← Back</button>
        <h2>Order Details – ${order.id}</h2>
      </div>
      <p><strong>Status:</strong> ${order.status}</p>
      <p><strong>Created:</strong> ${new Date(order.createdAt).toLocaleString()}</p>

      <hr>
      <h3>Item</h3>
      <p><strong>Listing:</strong> ${escapeHtml(listing.title)}</p>
      <p><strong>Store:</strong> ${escapeHtml(store.name)}</p>
      <p><strong>Quantity:</strong> ${order.quantity}</p>
      <p><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>

      <hr>
      <h3>Buyer</h3>
      <p>${escapeHtml(buyer.username)} (${escapeHtml(buyer.role)})</p>
    `;
    setMainHTML(html);
    $("#back-btn")?.addEventListener("click", () => {
      const cur = getCurrentUser();
      if (!cur) location.hash = "#login";
      else if (cur.role === "buyer") location.hash = "#buyer";
      else if (cur.role === "seller") location.hash = "#seller";
      else location.hash = "#admin";
    });
  }

  /* ----- Cart Page ----- */
  function renderCartPage() {
    const user = getCurrentUser();
    const cart = getCartForUser(user.id);
    const items = cart.items;

    const html = `
      <h2>Your Cart (${items.reduce((s,i)=>s+i.quantity,0)} items)</h2>
      ${items.length ? `
        <table>
          <thead>
            <tr><th>Listing</th><th>Price</th><th>Quantity</th><th>Subtotal</th><th>Action</th></tr>
          </thead>
          <tbody>
            ${items.map(item => {
              const lst = getListingById(item.listingId);
              const subtotal = lst.price * item.quantity;
              return `
                <tr data-id="${item.listingId}">
                  <td>${escapeHtml(lst.title)}</td>
                  <td>${formatPrice(lst.price)}</td>
                  <td><input type="number" min="1" value="${item.quantity}" class="cart-qty"></td>
                  <td>${formatPrice(subtotal)}</td>
                  <td><button class="remove-cart-item">Remove</button></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
        <p><strong>Grand Total:</strong> ${formatPrice(
          items.reduce((sum, i) => sum + getListingById(i.listingId).price * i.quantity, 0)
        )}</p>
        <button id="checkout-cart">Checkout</button>
      ` : "<p>Your cart is empty.</p>"}
    `;
    setMainHTML(html);

    // Quantity change
    $$(".cart-qty").forEach((input) => {
      input.addEventListener("change", () => {
        const row = input.closest("tr");
        const listingId = row.dataset.id;
        const qty = parseInt(input.value, 10);
        if (qty > 0) {
          const cart = getCartForUser(user.id);
          const item = cart.items.find((i) => i.listingId === listingId);
          if (item) item.quantity = qty;
          saveAppData();
          renderCartPage();
          showToast("Cart updated.", "success");
          renderNavBar();
        }
      });
    });
    // Remove item
    $$(".remove-cart-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = btn.closest("tr");
        const listingId = row.dataset.id;
        const cart = getCartForUser(user.id);
        cart.items = cart.items.filter((i) => i.listingId !== listingId);
        saveAppData();
        renderCartPage();
        showToast("Item removed.", "info");
        renderNavBar();
      });
    });
    // Checkout
    $("#checkout-cart")?.addEventListener("click", () => {
      if (!items.length) {
        showToast("Your cart is empty.", "danger");
        return;
      }
      items.forEach(item => {
        const listing = getListingById(item.listingId);
        const order = {
          id: generateId(),
          buyerId: user.id,
          storeId: listing.storeId,
          listingId: item.listingId,
          quantity: item.quantity,
          notes: "",
          status: "pending",
          createdAt: now()
        };
        appData.orders.push(order);
        // Notify seller + admin
        const sellerId = getStoreById(listing.storeId).sellerId;
        createMessage(user.id, sellerId,
          "New Order (Cart)",
          `Order #${order.id} placed from cart for "${listing.title}".`);
        const admin = getAdminUser();
        if (admin) createMessage(user.id, admin.id,
          "New Order (Cart)",
          `Buyer placed order #${order.id} from cart for "${listing.title}".`);
      });
      cart.items = [];
      saveAppData();
      showToast("All items ordered successfully!", "success");
      location.hash = "#buyer";
    });
  }

  /* ----- Messaging System (WhatsApp‑style) ----- */

  // Create a new message (store in appData.messages)
  function createMessage(fromId, toId, subject, body) {
    const msg = {
      id: generateId(),
      fromId,
      toId,
      subject,
      body,
      timestamp: now(),
      read: false
    };
    appData.messages.push(msg);
    saveAppData();
  }

  // Render the conversation list (left pane) – similar to WhatsApp
  function renderMessagesPage() {
    const user = getCurrentUser();
    // Build a map of otherUserId -> latestMessage
    const convMap = new Map(); // key: otherUserId, value: latestMessageObj
    appData.messages.forEach((msg) => {
      // Determine the "other" participant
      const otherId = msg.fromId === user.id ? msg.toId : msg.fromId;
      const existing = convMap.get(otherId);
      if (!existing || new Date(msg.timestamp) > new Date(existing.timestamp)) {
        convMap.set(otherId, msg);
      }
    });

    // Turn map into sorted array (most recent first)
    const conversations = Array.from(convMap.entries())
      .map(([otherId, latestMsg]) => ({
        otherId,
        latestMsg
      }))
      .sort((a, b) => new Date(b.latestMsg.timestamp) - new Date(a.latestMsg.timestamp));

    const html = `
      <div class="page-header">
        <button id="back-btn" class="back-btn">← Back</button>
        <h2>Messages</h2>
        <span class="spacer"></span>
        <button id="new-message-btn">New Message</button>
      </div>
      <div class="chat-wrapper">
        <div class="chat-list">
          ${conversations.length ? conversations.map(conv => {
            const otherUser = getUserById(conv.otherId);
            const unreadCount = appData.messages.filter(m =>
               m.toId === user.id && m.fromId === conv.otherId && !m.read).length;
            return `
              <div class="chat-list-item ${location.hash === "#chat/"+conv.otherId ? "active" : ""}"
                   data-id="${conv.otherId}">
                <span>${escapeHtml(otherUser.username)} (${otherUser.role})</span>
                ${unreadCount ? `<span class="unread-badge">${unreadCount}</span>` : ""}
              </div>
            `;
          }).join("") : `<p class="p-3">No conversations yet.</p>`}
        </div>
        <div class="chat-window">
          <div class="chat-header">Select a conversation</div>
          <div class="chat-messages"></div>
          <div class="chat-input" style="display:none;">
            <textarea placeholder="Type a message..."></textarea>
            <button type="button">Send</button>
          </div>
        </div>
      </div>
    `;
    setMainHTML(html);

    $("#back-btn")?.addEventListener("click", () => goBack("#" + getCurrentUser().role));
    $("#new-message-btn")?.addEventListener("click", () => renderSendMessagePage());

    // Click on a conversation to open chat
    $$(".chat-list-item").forEach((item) => {
      item.addEventListener("click", () => {
        const otherId = item.dataset.id;
        location.hash = `#chat/${otherId}`;
      });
    });
  }

  // Render a chat with a specific user (WhatsApp‑style bubbles)
  function renderChatPage(otherUserId) {
    const user = getCurrentUser();
    const otherUser = getUserById(otherUserId);
    if (!otherUser) {
      setMainHTML("<p>User not found.</p>");
      return;
    }

    // Mark all messages sent *to* the current user from this other user as read
    appData.messages.forEach(m => {
      if (m.fromId === otherUserId && m.toId === user.id) {
        m.read = true;
      }
    });
    saveAppData();

    // Gather conversation messages (both directions) sorted chronologically
    const convMsgs = appData.messages
      .filter(m => (m.fromId === user.id && m.toId === otherUserId) ||
                   (m.fromId === otherUserId && m.toId === user.id))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const html = `
      <div class="page-header">
        <button id="back-btn" class="back-btn">← Back</button>
        <h2>Chat</h2>
      </div>
      <div class="chat-wrapper">
        <div class="chat-list">
          <div class="chat-list-item active" data-id="${otherUserId}">
            <span>${escapeHtml(otherUser.username)} (${otherUser.role})</span>
          </div>
        </div>
        <div class="chat-window">
          <div class="chat-header">${escapeHtml(otherUser.username)} (${otherUser.role})</div>
          <div class="chat-messages" id="chat-messages">
            ${convMsgs.map(m => {
              const isSent = m.fromId === user.id;
              const statusClass = isSent ? (m.read ? "read" : "delivered") : "";
              const tick = isSent ? (m.read ? "✔✔" : "✔✔") : "";
              const tickClass = isSent && m.read ? "read" : "";
              return `
                <div class="msg-bubble ${isSent ? "msg-sent" : "msg-received"}">
                  <div>${escapeHtml(m.body)}</div>
                  ${isSent ? `<span class="msg-status ${tickClass}">${tick}</span>` : ""}
                </div>
              `;
            }).join("")}
          </div>
          <div class="chat-input">
            <textarea id="chat-input-area" placeholder="Type a message..."></textarea>
            <button id="chat-send-btn">Send</button>
          </div>
        </div>
      </div>
    `;
    setMainHTML(html);

    $("#back-btn")?.addEventListener("click", () => goBack("#messages"));

    // Auto‑scroll to bottom
    const msgsDiv = $("#chat-messages");
    msgsDiv.scrollTop = msgsDiv.scrollHeight;

    // Send new message
    $("#chat-send-btn").addEventListener("click", () => {
      const body = $("#chat-input-area").value.trim();
      if (!body) return;
      createMessage(user.id, otherUserId, "", body);
      $("#chat-input-area").value = "";
      // re‑render chat to include the new message
      renderChatPage(otherUserId);
    });
  }

  // Compose a new message (blank chat, choose recipient)
  function renderSendMessagePage(preselectedRecipientId = null) {
    const user = getCurrentUser();
    // Build recipient list based on role
    const possibleRecipients = appData.users.filter(u => u.id !== user.id);

    const html = `
      <div class="page-header">
        <button id="back-btn" class="back-btn">← Back</button>
        <h3>Compose Message</h3>
        <span class="spacer"></span>
        <small style="color:var(--clr-muted);">To anyone in the community</small>
      </div>
      <form id="send-message-form">
        <label>To
          <select name="toId" required>
            ${possibleRecipients.map(r => `
              <option value="${r.id}"${preselectedRecipientId===r.id?" selected":""}>
                ${escapeHtml(r.username)} (${r.role})
              </option>
            `).join("")}
          </select>
        </label>
        <label>Subject
          <input type="text" name="subject">
        </label>
        <label>Message
          <textarea name="body" rows="5" required></textarea>
        </label>
        <button type="submit">Send</button>
        <button type="button" id="cancel-send">Cancel</button>
      </form>
    `;
    setMainHTML(html);
    $("#back-btn")?.addEventListener("click", () => goBack("#messages"));
    $("#send-message-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const toId = e.target.toId.value;
      const subject = e.target.subject.value.trim() || "";
      const body = e.target.body.value.trim();
      if (!body) {
        showMessage("Message body cannot be empty.");
        return;
      }
      createMessage(user.id, toId, subject, body);
      showToast("Message sent!", "success");
      location.hash = "#messages";
    });
    $("#cancel-send").addEventListener("click", () => location.hash = "#messages");
  }

  /* -------------------------------------------------
     End of file – all functions used above are defined.
     ------------------------------------------------- */
})();
