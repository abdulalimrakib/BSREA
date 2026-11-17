# Putting BSREA live

This guide uses one Linux server (Ubuntu 24.04) to run all three apps behind nginx with free HTTPS from Let's Encrypt. The backend stores its database and the uploaded documents on the server's disk, so it needs a real server with a persistent disk. Serverless hosting such as Vercel or Netlify won't work for it.

| Address | App | Runs on (inside the server) |
| --- | --- | --- |
| `https://bsreabd.org` | Public website | `127.0.0.1:3004` |
| `https://admin.bsreabd.org` | Admin panel | `127.0.0.1:3001` |
| `…/api/` on both addresses | Backend | `127.0.0.1:3002` |

The ready-made files are in `deploy/`:
- `nginx-bsrea.conf`: the web server
- `ecosystem.config.cjs`: keeps the apps running
- `crontab.txt`: nightly backups

> **Try it on test addresses first.** bsreabd.org is the live WordPress site today. Put the new system on `new.bsreabd.org` and `admin-new.bsreabd.org` first, test everything, and only then move the main domain (step 11). For the test run, replace the domain names in steps 3, 5, 6 and 8.

---

## Running it for free

Everything except the server is already free: HTTPS (Let's Encrypt), the web server (nginx), PM2, ClamAV, and off-server backups (rclone to a 15 GB Google Drive). The domain is already paid for. Only the server costs money, and two providers give away a small server permanently:

| | **Oracle Cloud Always Free** (recommended) | **Google Cloud Free Tier** (fallback) |
| --- | --- | --- |
| Free server | Ampere A1 (ARM) VM. Recent reports say the free allowance is now 2 CPUs / 12 GB RAM; check the console | 1 × e2-micro: 2 shared CPUs, **1 GB RAM**, 30 GB disk |
| Enough for BSREA? | Yes, including the virus scanner | Only without ClamAV, and the sites must be built on your own computer (1 GB is too little to build them) |
| Region | Pick Singapore or Mumbai (closest to Bangladesh) | **Only** us-west1, us-central1 or us-east1 are free (slower from Bangladesh) |
| Card | Needed to verify the account; not charged within the free limits | Same |

Before choosing free hosting, know the trade-offs:
- **No guarantee:** both companies can change or end the free offer. Oracle may take back an "idle" free server, and users have reported free ARM servers being switched off after limit changes. **Keep the nightly off-server backups (step 10)**: with them, the site can be moved to another server within an hour.
- **Account ownership:** open the account with a BSREA email, not a personal one, so the association keeps access if a staff member leaves.
- **Free ARM capacity** in popular regions is sometimes "out of capacity". Retry later or try another region.
- **When real member data starts coming in,** consider a paid VPS (about USD 5–6 a month) for reliability. The steps below are the same.

**Oracle Cloud traps** (Ubuntu image):
- Open ports 80 and 443 in **two** places:
  - in the VCN's Security List (Networking → Virtual Cloud Networks → Security Lists → add ingress rules for TCP 80 and 443 from 0.0.0.0/0);
  - on the server itself, where Oracle's Ubuntu image blocks them with iptables:
    ```bash
    sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
    sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
    sudo netfilter-persistent save
    ```
  - Use these instead of `ufw` on Oracle.
- Choose the **Ubuntu 24.04 (aarch64)** image. Node.js 24 and ClamAV both run on ARM.

**Google Cloud e2-micro:**
1. **Swap space:** add 2 GB of swap, or the apps run out of memory:
   ```bash
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
2. **Build on your own computer:** in step 6, build the sites locally, with the same `.env.production.local` files. Then copy them across:
   ```bash
   rsync -a client/.next bsrea@SERVER:/srv/bsrea/client/
   rsync -a admin/.next bsrea@SERVER:/srv/bsrea/admin/
   ```
   On the server, only run `npm ci --omit=dev` in `client/` and `admin/`.
3. **Skip ClamAV:** skip step 9 and leave `CLAMAV_HOST` out of `backend/.env`. Uploads are still checked by file type, encrypted, and only opened by staff.

## 1. Rent a server

- **Size:** Ubuntu 24.04 with **4 GB RAM** and 2 CPUs. 2 GB is enough without the virus scanner, which alone uses about 1.5 GB.
- **Disk:** at least 40 GB.
- **Providers:** DigitalOcean, Hetzner, Vultr, AWS Lightsail, or a hosting company in Bangladesh, for about USD 12–25 a month.
- **Login:** log in with an SSH key, not a password.

## 2. Prepare the server

```bash
# As root, once
adduser bsrea && usermod -aG sudo bsrea           # a normal user to run the apps
apt update && apt upgrade -y
apt install -y nginx git ufw unattended-upgrades clamav-daemon
dpkg-reconfigure -plow unattended-upgrades          # automatic security updates

# Firewall: only SSH and the website are open; the apps' ports stay closed to the internet
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable

# Node.js 24 (the backend's database needs Node 22.13 or newer)
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
npm install -g pm2
```

## 3. Point the domain at the server

In the domain's DNS settings, add **A records** pointing to the server's IP address:

| Name | Type | Value |
| --- | --- | --- |
| `admin` | A | server IP |
| `new`, `admin-new` (test run) | A | server IP |
| `@` and `www` | A | server IP: **only at step 11**, when switching the live site |

**Don't change the MX records.** They deliver the `@bsreabd.org` email.

## 4. Copy the project to the server

The project isn't in git yet. The safest way is a **private** GitHub repository:

```bash
# On your computer, in the project folder
git init && git add . && git status    # check: no .env, storage/, *.db, *.private.json or backups/
git commit -m "BSREA website and membership system"
git remote add origin git@github.com:<you>/bsrea.git && git push -u origin main
```

`.gitignore` already keeps out the secrets and personal data. **Check `git status` before the first commit anyway.**

Then, on the server, as the `bsrea` user:

```bash
sudo mkdir -p /srv/bsrea && sudo chown bsrea: /srv/bsrea
git clone git@github.com:<you>/bsrea.git /srv/bsrea
```

The member list with contact details is deliberately **not** in git. Copy it straight from your computer:

```bash
scp backend/data/members.private.json bsrea@SERVER:/srv/bsrea/backend/data/
ssh bsrea@SERVER chmod 600 /srv/bsrea/backend/data/members.private.json
```

## 5. Configure the backend

```bash
cd /srv/bsrea/backend
npm ci                        # include dev dependencies: the backend runs with ts-node
npm run keygen                # prints two NEW keys for production
nano .env && chmod 600 .env
```

`backend/.env` on the server:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3002
TRUST_PROXY=1
CORS_ORIGINS=https://bsreabd.org,https://www.bsreabd.org,https://admin.bsreabd.org
PUBLIC_SITE_URL=https://bsreabd.org
ENCRYPTION_KEY=<from npm run keygen>
BLIND_INDEX_KEY=<from npm run keygen>
BACKUP_DIR=/var/backups/bsrea
CLAMAV_HOST=127.0.0.1
CLAMAV_PORT=3310
```

- **Use new keys, not the ones from your computer.** The production database is created fresh in the next step.
- **Store both keys in a password manager.** If `ENCRYPTION_KEY` is lost, the encrypted data and the backups can't be read again.

Then create the database, import the members and create your admin account:

```bash
sudo mkdir -p /var/backups/bsrea && sudo chown bsrea: /var/backups/bsrea && chmod 700 /var/backups/bsrea
npm run seed -- --admin-email you@bsreabd.org --admin-name "Your Name"     # asks for a password
```

## 6. Build the two websites

These addresses are built into the websites, so set them **before** building:

```bash
cd /srv/bsrea/client
echo "NEXT_PUBLIC_API_URL=https://bsreabd.org" > .env.production.local
npm ci && npm run build

cd /srv/bsrea/admin
printf "NEXT_PUBLIC_API_URL=https://admin.bsreabd.org\nNEXT_PUBLIC_SITE_URL=https://bsreabd.org\n" > .env.production.local
npm ci && npm run build
```

## 7. Start the apps

```bash
cd /srv/bsrea
pm2 start deploy/ecosystem.config.cjs
pm2 save && pm2 startup          # run the command it prints, so the apps start after a reboot
pm2 status                       # all three should say "online"
curl -s http://127.0.0.1:3002/health    # {"status":"ok"}
```

## 8. nginx and HTTPS

```bash
sudo cp /srv/bsrea/deploy/nginx-bsrea.conf /etc/nginx/sites-available/bsrea
sudo ln -s /etc/nginx/sites-available/bsrea /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bsreabd.org -d www.bsreabd.org -d admin.bsreabd.org
```

Certbot adds HTTPS to the nginx config and renews the certificates automatically.

**Optional:** to let only the office reach the admin panel, uncomment the `allow`/`deny` lines in the nginx file.

## 9. Virus scanner

By default, ClamAV listens on a socket file. The backend needs it on a local port:

```bash
sudo nano /etc/clamav/clamd.conf      # add:  TCPSocket 3310   and   TCPAddr 127.0.0.1
sudo systemctl restart clamav-daemon && sudo systemctl enable clamav-daemon
```

Once `CLAMAV_HOST` is set, every upload is scanned. **If the scanner is down, uploads are refused, not let through.**

## 10. Backups

1. **Install the nightly jobs:** `crontab -e`, then paste the lines from `deploy/crontab.txt`.
2. **Copy the backups off the server:** install `rclone`, connect it to Google Drive, S3 or another server (`rclone config`, name the remote `offsite`), and keep the second line of `crontab.txt`. A backup kept only on the same server is lost with the server.
3. **Test a restore once**, on another machine or folder: `npm run restore -- <backup folder>`. You need the same `ENCRYPTION_KEY`.

## 11. Check everything, then go live

On the test addresses, use made-up companies and people:
- [ ] Apply on the public site → you get a reference number
- [ ] Review it in the admin panel → approve → a certificate is issued
- [ ] Apply again with the same trade licence → refused
- [ ] Apply with an email shared with an earlier application → accepted but flagged; the person who checks the matches can't approve it

- [ ] `https://` works on both addresses, and `http://` redirects to it
- [ ] The admin login asks you to set up the authenticator app (two-factor login is required in production)
- [ ] Applying with a real PDF works, and a renamed `.exe` is refused
- [ ] The QR code on a certificate opens `https://bsreabd.org/verify/…` and shows **Valid**
- [ ] `pm2 status` shows all three apps online after `sudo reboot`
- [ ] `npm run backup -- --verify` reports OK
- [ ] Old WordPress links still work. The redirects are in `client/next.config.ts`; try a few old news URLs

**Going live:**
1. Lower the DNS TTL to 5 minutes a day in advance.
2. Point the `@` and `www` A records at the server.
3. Run `sudo certbot --nginx -d bsreabd.org -d www.bsreabd.org`.
4. Keep the old WordPress hosting for a few weeks in case something needs to be checked.

## Updating later

```bash
cd /srv/bsrea && git pull
(cd backend && npm ci)
(cd client && npm ci && npm run build)
(cd admin && npm ci && npm run build)
pm2 restart all
```

**Run `npm run backup` before every update.** If an update changes the database layout, the backend refuses to start on the old layout instead of damaging data; the update's notes will say how to upgrade.

## If something goes wrong

| Problem | Where to look |
| --- | --- |
| An app is down | `pm2 status`, `pm2 logs bsrea-api` (or `bsrea-admin`, `bsrea-site`) |
| 502 Bad Gateway | The app behind nginx isn't running: `pm2 restart all` |
| "The backend gave an answer that can't be read" | `NEXT_PUBLIC_API_URL` was wrong when the site was built: fix `.env.production.local` and rebuild |
| "Request blocked: unknown origin" | The website's address is missing from `CORS_ORIGINS` in `backend/.env`: add it, `pm2 restart bsrea-api` |
| Uploads refused with "can't be checked right now" | ClamAV is down: `sudo systemctl status clamav-daemon` |
| Forgot the admin password | `cd backend && npm run reset-password` |
