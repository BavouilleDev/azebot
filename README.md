# AzeBot

## Lien d’invitation Discord

Ouvre cette URL dans un navigateur (compte avec droit « Gérer le serveur » sur la cible) :

https://discord.com/oauth2/authorize?client_id=1485039498743120034&permissions=84992&integration_type=0&scope=bot+applications.commands

## Mise à jour sur le VPS (depuis GitHub)

Sur ta machine locale, pousse les changements :

```bash
git add -A
git commit -m "Message de commit"
git push origin main
```

Sur le VPS (SSH), dans le dossier du clone du repo (là où se trouve `package.json`) :

```bash
cd ~/azebot
git pull origin main
```

Si `package.json` ou `package-lock.json` ont changé :

```bash
npm install
```

Redémarrage du service systemd (nom du service à adapter si besoin) :

```bash
sudo systemctl restart azebot
sudo systemctl status azebot
```

Le fichier `.env` reste sur le VPS (il n’est pas dans le dépôt) : pas besoin de le refaire à chaque `git pull`.
