#!/usr/bin/env bash
# Run only on the new Ubuntu 24.04 EC2 created for this application.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y docker.io docker-compose-v2 git ca-certificates openssl
systemctl enable --now docker

if ! swapon --show=NAME --noheadings | grep -q .; then
  if [ ! -e /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
fi

repository=https://github.com/giathinhnguyen/CNPM_Nh-m-18_CampusCare.git
if [ ! -e /opt/brewlite ]; then
  git clone --branch main --single-branch "$repository" /opt/brewlite
else
  [ -d /opt/brewlite/.git ] || { echo '/opt/brewlite is not the expected repository'; exit 1; }
  [ "$(git -C /opt/brewlite remote get-url origin)" = "$repository" ] || { echo 'Unexpected repository'; exit 1; }
fi
chown -R ubuntu:ubuntu /opt/brewlite
printf 'EC2 bootstrap ready. Upload .env.production before starting BrewLite.\n'
