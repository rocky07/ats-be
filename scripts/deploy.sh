#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/deploy.sh <public_key_path> <git_repo_url> [private_key_path]
PK_PATH=${1:-$HOME/.ssh/ats_deploy.pub}
GIT_REPO=${2:-}
PRIV_KEY=${3:-$HOME/.ssh/ats_deploy}

if [ -z "$GIT_REPO" ]; then
  echo "Usage: $0 <public_key_path> <git_repo_url> [private_key_path]"
  exit 1
fi

# Initialize and apply Terraform
pushd terraform >/dev/null
terraform init
terraform apply -auto-approve -var "key_name=ats_deploy" -var "public_key_path=${PK_PATH}" -var "github_repo=${GIT_REPO}"
PUBLIC_IP=$(terraform output -raw public_ip)
popd >/dev/null

echo "Writing inventory with host ${PUBLIC_IP}"
cat > ansible/inventory.ini <<EOF
[web]
${PUBLIC_IP} ansible_user=ec2-user ansible_host=${PUBLIC_IP}
EOF

echo "Running Ansible playbook..."
ansible-playbook -i ansible/inventory.ini --private-key "${PRIV_KEY}" ansible/playbook.yml -e "app_repo=${GIT_REPO}"

echo "Deployment complete. Visit http://${PUBLIC_IP}:3000 or http://${PUBLIC_IP}"
