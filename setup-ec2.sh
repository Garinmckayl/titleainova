#!/bin/bash
# ============================================================================
# Title AI + LegalMindz — EC2 Setup Script
# 
# Run on a fresh Ubuntu 22.04+ EC2 instance (t3.small or larger recommended)
# This sets up both:
#   1. Nova Act sidecar (Flask, port 8001) — for Title AI browser automation
#   2. Sonic bridge (Node.js WebSocket, port 8002) — for LegalMindz voice AI
#
# Prerequisites:
#   - EC2 instance with ports 8001 and 8002 open in security group
#   - AWS credentials with Bedrock access (Nova Act + Nova 2 Sonic)
#
# Usage:
#   1. SSH into your EC2 instance
#   2. Set your AWS credentials:
#        export AWS_ACCESS_KEY_ID=your_key
#        export AWS_SECRET_ACCESS_KEY=your_secret
#        export AWS_REGION=us-east-1
#   3. Run: bash setup-ec2.sh
#   4. Set on Vercel:
#        NOVA_ACT_SERVICE_URL=http://YOUR_EC2_IP:8001
#        NEXT_PUBLIC_SONIC_WS_URL=ws://YOUR_EC2_IP:8002
# ============================================================================

set -e

echo "=== EC2 Setup for Title AI + LegalMindz ==="

# Check AWS credentials
if [ -z "$AWS_ACCESS_KEY_ID" ]; then
  echo "ERROR: Set AWS_ACCESS_KEY_ID first"
  exit 1
fi

# Install system deps
echo "--- Installing system dependencies ---"
sudo apt-get update -y
sudo apt-get install -y python3 python3-pip python3-venv nodejs npm git

# Install Node.js 20 if not available
if ! node -v 2>/dev/null | grep -q "v2[0-9]"; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# ============================================================================
# 1. Nova Act Sidecar (Title AI)
# ============================================================================
echo ""
echo "=== Setting up Nova Act Sidecar ==="

mkdir -p ~/nova-act-sidecar
cd ~/nova-act-sidecar

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install nova-act SDK + Flask
pip install flask nova-act pydantic

# Write env file
cat > .env <<EOF
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_REGION=${AWS_REGION:-us-east-1}
EOF

# Copy the sidecar code (assumes the repo is cloned)
if [ -d ~/titleainova ]; then
  cp ~/titleainova/nova-act-service/main.py ./main.py
elif [ -d ~/titleai-nova ]; then
  cp ~/titleai-nova/nova-act-service/main.py ./main.py
else
  echo "WARNING: Could not find nova-act-service/main.py"
  echo "Clone the repo first: git clone git@github.com:Garinmckayl/titleainova.git ~/titleainova"
fi

deactivate

# Create systemd service
sudo tee /etc/systemd/system/nova-act-sidecar.service > /dev/null <<EOF
[Unit]
Description=Nova Act Sidecar for Title AI
After=network.target

[Service]
User=$USER
WorkingDirectory=/home/$USER/nova-act-sidecar
EnvironmentFile=/home/$USER/nova-act-sidecar/.env
ExecStart=/home/$USER/nova-act-sidecar/venv/bin/python main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# ============================================================================
# 2. Sonic Bridge (LegalMindz)
# ============================================================================
echo ""
echo "=== Setting up Sonic Bridge ==="

mkdir -p ~/sonic-bridge
cd ~/sonic-bridge

# Write env file
cat > .env <<EOF
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_REGION=${AWS_REGION:-us-east-1}
SONIC_PORT=8002
EOF

# Copy sonic bridge code
if [ -d ~/legalmindznova ]; then
  cp ~/legalmindznova/sonic-bridge/server.js ./server.js
  cp ~/legalmindznova/sonic-bridge/package.json ./package.json
elif [ -d ~/legalmindz-nova ]; then
  cp ~/legalmindz-nova/sonic-bridge/server.js ./server.js
  cp ~/legalmindz-nova/sonic-bridge/package.json ./package.json
else
  echo "WARNING: Could not find sonic-bridge/"
  echo "Clone the repo first: git clone git@github.com:Garinmckayl/legalmindznova.git ~/legalmindznova"
fi

npm install

# Create systemd service
sudo tee /etc/systemd/system/sonic-bridge.service > /dev/null <<EOF
[Unit]
Description=Nova 2 Sonic WebSocket Bridge for LegalMindz
After=network.target

[Service]
User=$USER
WorkingDirectory=/home/$USER/sonic-bridge
EnvironmentFile=/home/$USER/sonic-bridge/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# ============================================================================
# Start everything
# ============================================================================
echo ""
echo "=== Starting services ==="

sudo systemctl daemon-reload
sudo systemctl enable nova-act-sidecar sonic-bridge
sudo systemctl start nova-act-sidecar sonic-bridge

sleep 2

echo ""
echo "=== Status ==="
echo "Nova Act Sidecar (port 8001):"
sudo systemctl status nova-act-sidecar --no-pager -l | head -5
echo ""
echo "Sonic Bridge (port 8002):"
sudo systemctl status sonic-bridge --no-pager -l | head -5

# Get public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "YOUR_EC2_IP")

echo ""
echo "============================================"
echo "  DONE! Set these on Vercel:"
echo ""
echo "  Title AI (titleainova):"
echo "    NOVA_ACT_SERVICE_URL=http://$PUBLIC_IP:8001"
echo ""
echo "  LegalMindz (legalmindznova):"
echo "    NEXT_PUBLIC_SONIC_WS_URL=ws://$PUBLIC_IP:8002"
echo ""
echo "  EC2 Security Group: open ports 8001, 8002"
echo "============================================"
