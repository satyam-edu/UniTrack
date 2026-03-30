# 🎓 UniTrack

> A modern, beautifully designed Progressive Web App (PWA) to track college attendance, manage daily schedules, and ensure you never fall below your target percentage.

**Live Demo:** [unitrack.dev](https://unitrack.dev)

---

## ✨ Features

* **📱 Progressive Web App (PWA):** Fully installable on iOS and Android home screens for a native app experience.
* **📊 Smart Attendance Math:** Custom algorithms track your theory and lab attendance, visually displaying how many classes you can afford to miss (or need to attend) to hit your target.
* **🎨 Premium UI/UX:** Designed with a sleek dark mode, animated SVG progress rings, and seamless skeleton loading states for zero perceived latency.
* **🗓️ Bulletproof Timetable:** A custom daily schedule builder featuring strict time-range validation and overlap prevention logic.
* **🔐 Secure Authentication:** Passwordless or email-based login powered by Supabase, strictly locking user data behind Row Level Security (RLS) policies.

---

## 🛠️ Tech Stack

**Frontend:**
* [Next.js (App Router)](https://nextjs.org/) - React framework
* [Tailwind CSS](https://tailwindcss.com/) - Utility-first styling
* Custom SVG Animations & Skeleton Loaders

**Backend & Database:**
* [Supabase](https://supabase.com/) - Open-source Firebase alternative
* PostgreSQL - Relational database
* Row Level Security (RLS) - Data privacy

**Deployment & Routing:**
* [Vercel](https://vercel.com/) - Edge network hosting
* Custom `.dev` domain routing with enforced HTTPS

---

## 🚀 Running Locally

Want to run this project on your own machine? Just copy and run this single block in your terminal to set everything up:

```bash
# 1. Clone the repository and navigate into it
git clone [https://github.com/satyam-edu/UniTrack.git](https://github.com/satyam-edu/UniTrack.git)
cd UniTrack

# 2. Install dependencies
npm install

# 3. Create the environment file (Replace the dummy values with your actual Supabase keys after running this)
echo "NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url" > .env.local
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key" >> .env.local
echo "SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key" >> .env.local

# 4. Start the development server
npm run dev

After running this, open http://localhost:3000 in your browser to see the app.

### AUTHOR
Satyam & Shreyansh

GitHub: https://github.com/satyam-edu
        https://github.com/shreyansh0714

LinkedIn: www.linkedin.com/in/satyam-in
          www.linkedin.com/in/shreyansh-jain-56b673263