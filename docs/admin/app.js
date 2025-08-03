// admin/app.js (güncellenmiş sürüm)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- DOM ----------
const authView   = document.getElementById("authView");
const appView    = document.getElementById("appView");
const whoami     = document.getElementById("whoami");
const signInBtn  = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");

const addOpen      = document.getElementById("addOpen");
const imageFile    = document.getElementById("imageFile");
const formCard     = document.getElementById("formCard");
const formTitle    = document.getElementById("formTitle");
const nameInput    = document.getElementById("nameInput");
const priceInput   = document.getElementById("priceInput");
const categoryInput= document.getElementById("categoryInput");
const saveBtn      = document.getElementById("saveBtn");
const cancelBtn    = document.getElementById("cancelBtn");
const preview      = document.getElementById("preview");
const noPreview    = document.getElementById("noPreview");
const rows         = document.getElementById("rows");

let currentImageFile = null;

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    whoami.textContent = session.user.email;
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    signOutBtn.classList.remove("hidden");
    loadItems();
  } else {
    whoami.textContent = "";
    authView.classList.remove("hidden");
    appView.classList.add("hidden");
    signOutBtn.classList.add("hidden");
  }
});

signInBtn?.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) alert("Giriş hatası: " + error.message);
});

signOutBtn?.addEventListener("click", () => {
  whoami.textContent = "";
  authView.classList.remove("hidden");
  appView.classList.add("hidden");
  signOutBtn.classList.add("hidden");
  try {
    Object.keys(localStorage).filter(k => k.startsWith("sb-")).forEach(k => localStorage.removeItem(k));
    Object.keys(sessionStorage).filter(k => k.startsWith("sb-")).forEach(k => sessionStorage.removeItem(k));
  } catch {}
  supabase.auth.signOut({ scope: "local" });
  supabase.auth.signOut({ scope: "global" });
  setTimeout(() => location.reload(), 300);
});

addOpen?.addEventListener("click", () => imageFile.click());

imageFile?.addEventListener("change", () => {
  currentImageFile = imageFile.files?.[0] ?? null;
  if (currentImageFile) {
    const r = new FileReader();
    r.onload = (e) => {
      preview.src = e.target.result;
      preview.classList.remove("hidden");
      noPreview.classList.add("hidden");
      formCard.classList.remove("hidden");
      formTitle.textContent = "Yeni Ürün Ekle";
    };
    r.readAsDataURL(currentImageFile);
  }
});

cancelBtn?.addEventListener("click", resetForm);

function toggleSaving(state) {
  if (!saveBtn) return;
  saveBtn.disabled = state;
  saveBtn.textContent = state ? "Kaydediliyor..." : "Kaydet";
}

function resetForm() {
  formCard.classList.add("hidden");
  preview.classList.add("hidden");
  noPreview.classList.remove("hidden");
  nameInput.value = "";
  priceInput.value = "";
  categoryInput.value = "";
  currentImageFile = null;
  imageFile.value = "";
}

function makeSafeName(filename) {
  const parts = filename.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  const base = parts.join(".");
  const asciiBase = base.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  return ext ? `${asciiBase}.${ext}` : asciiBase;
}

saveBtn?.addEventListener("click", async () => {
  toggleSaving(true);
  try {
    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value.replace(",", "."));
    const category = categoryInput.value.trim();

    if (!name || isNaN(price) || !currentImageFile) {
      alert("Tüm alanları doldurun ve görsel seçin.");
      toggleSaving(false);
      return;
    }

    const safeName = makeSafeName(currentImageFile.name);
    const now = new Date();
    const folder = `menu/${now.getFullYear()}/${String(now.getMonth()+1).padStart(2, "0")}`;
    const path = `${folder}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage.from("menu-images").upload(path, currentImageFile);
    if (uploadError) throw new Error("Görsel yüklenemedi: " + uploadError.message);

    const { data: pub } = supabase.storage.from("menu-images").getPublicUrl(path);
    const image_url = pub?.publicUrl;

    const { error: insertError } = await supabase.from("menu_items").insert([{ name, price, category, image_url }]);
    if (insertError) throw new Error("Kayıt hatası: " + insertError.message);

    resetForm();
    await loadItems();
    alert("Ürün başarıyla eklendi.");
  } catch (err) {
    alert(err.message);
  } finally {
    toggleSaving(false);
  }
});

async function loadItems() {
  rows.innerHTML = "";
  const { data, error } = await supabase.from("menu_items").select("*").order("created_at", { ascending: false });
  if (error) {
    alert("Ürünler listelenemedi: " + error.message);
    return;
  }
  for (const item of data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="px-4 py-2"><img src="${item.image_url}" class="h-14 w-14 object-cover rounded-md border" /></td>
      <td class="px-4 py-2">${item.name}</td>
      <td class="px-4 py-2">₺${item.price}</td>
      <td class="px-4 py-2">${item.category || "-"}</td>
      <td class="px-4 py-2 text-right">
        <button data-del="${item.id}" class="px-3 py-1.5 rounded-md border hover:bg-zinc-100">Sil</button>
      </td>
    `;
    rows.appendChild(tr);
  }
  rows.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Silmek istediğinize emin misiniz?")) return;
      const id = btn.getAttribute("data-del");
      const { error } = await supabase.from("menu_items").delete().eq("id", id);
      if (error) {
        alert("Silme hatası: " + error.message);
        return;
      }
      await loadItems();
    });
  });
}
