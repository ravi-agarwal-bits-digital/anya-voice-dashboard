# 🎙️ Voice Analytics Dashboard - GitHub Pages

**Simple, Secure, Automated. Everything on GitHub.**

---

## ⚡ The Flow

```
You (Admin)                GitHub                  End Users
    ↓                       ↓                          ↓
Upload Excel file
Enter password
Click "Publish"
    ↓
git push
                    ↓ Triggers Actions
                    ↓ Auto-publishes
                                    ✨ Dashboard live!
                                    ✨ See fresh data
```

---

## 🚀 Setup (One-Time)

### 1. Create GitHub Repo

```bash
# On GitHub.com:
# Create new repo: "voice-analytics"
# Clone it:

git clone https://github.com/YOUR_USERNAME/voice-analytics.git
cd voice-analytics
```

### 2. Add Files (Copy-Paste These)

**Files you need:**
- `BITS_KAI_Master_Dashboard.html` → Save as `index.html`
- `admin_index.html` → Save to `admin/index.html`
- `deploy.yml` → Save to `.github/workflows/deploy.yml`

**Create folders:**
```bash
mkdir -p admin
mkdir -p data
mkdir -p .github/workflows
```

### 3. Change Admin Password

Edit `admin/index.html`:

Line 103:
```javascript
const ADMIN_PASSWORD = "bits2024";
```

Change to YOUR password (anything you want!)

### 4. Push to GitHub

```bash
git add .
git commit -m "Setup Voice Analytics"
git push
```

### 5. Enable GitHub Pages

1. Go to repo **Settings**
2. Click **Pages** (left sidebar)
3. Under "Build and deployment":
   - Select: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/ (root)**
4. Click **Save**

**🎉 Live at:** `https://YOUR_USERNAME.github.io/voice-analytics/`

---

## 📤 Daily Upload (Repeat Every Day)

### Admin (You):

```bash
# 1. Get Excel from Aanya bot
# 2. Rename to today's date, e.g.:
#    voice_analytics_2026-06-20.xlsx

# 3. Save to data/ folder

# 4. Push to GitHub:
git add data/voice_analytics_*.xlsx
git commit -m "Update voice analytics - $(date +%Y-%m-%d)"
git push

# ✨ Done! GitHub Actions auto-publishes within 2 minutes
```

### End Users:

Share this link:
```
https://YOUR_USERNAME.github.io/voice-analytics/
```

They see the dashboard. No login needed. All live data.

---

## 🔐 Access

| User Type | URL | Password | Can Edit |
|-----------|-----|----------|----------|
| **End Users** | `/index.html` | None | ❌ No |
| **Admin** | `/admin/index.html` | Yes | ✅ Upload only |
| **GitHub** | Settings → Pages | Token | ✅ Auto |

---

## 📁 Folder Structure

```
voice-analytics/
├── index.html                          ← Dashboard (for end users)
├── admin/
│   └── index.html                      ← Admin upload page
├── data/
│   ├── voice_analytics_2026-06-20.xlsx ← Latest
│   ├── voice_analytics_2026-06-19.xlsx ← Yesterday
│   └── voice_analytics_2026-06-18.xlsx ← History
├── .github/workflows/
│   └── deploy.yml                      ← Auto-publish
└── README.md
```

---

## ✨ Features

✅ **Zero Cost** (GitHub Pages is free)  
✅ **Zero Servers** (All on GitHub)  
✅ **Zero Configuration** (Just upload Excel)  
✅ **Auto-Publish** (Push → Live in 2 min)  
✅ **Full History** (All Excels backed up)  
✅ **Clean Dashboard** (No code visible)  
✅ **Secure** (Password for admin only)  

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Dashboard not live | Wait 5 min, clear browser cache, check Pages in Settings |
| Upload not working | Check admin password is correct, Excel is .xlsx |
| Actions not running | Check `.github/workflows/deploy.yml` exists |
| GitHub Pages showing 404 | Check Settings → Pages → "Deploy from main" selected |

---

## 🎯 Example

**Monday 9 AM:**
```bash
# I get: voice_analytics_2026-06-20.xlsx
# I save it to: data/voice_analytics_2026-06-20.xlsx

git add data/voice_analytics_2026-06-20.xlsx
git commit -m "Update voice analytics - 2026-06-20"
git push

# ✨ 2 minutes later...
# Dashboard shows today's data!
```

**Your team sees:**
- 50 new hot leads
- 5 serial engagers
- 12 frustrated callers
- All filters working
- All live data

---

## 💡 Pro Tips

🎯 **Automate Excel export** → Use API to auto-download from Aanya  
🎯 **Schedule updates** → GitHub Actions can run on schedule (daily 9 AM)  
🎯 **Custom domain** → Add CNAME for yourcompany.com  
🎯 **Private repo** → GitHub Pages still works (choose visibility in Pages settings)  
🎯 **Multiple repos** → One per department or bot  

---

## 📞 Questions?

Check the workflow files in `.github/workflows/` - they're well commented!

---

**Ready to go!** Follow the setup above and you're live in 15 minutes. 🚀
