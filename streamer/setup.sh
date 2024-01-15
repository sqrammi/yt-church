#!/bin/sh

sudo add-apt-repository ppa:obsproject/obs-studio
sudo apt update
sudo apt install obs-studio

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt update
sudo apt install nodejs
