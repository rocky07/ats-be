# Deploying ATS-BE to EC2 (Terraform + Ansible)

Prereqs:
- AWS credentials set in environment (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` or use AWS CLI profile)
- Terraform installed
- Ansible installed
- A local SSH keypair (or create one with `ssh-keygen -f ~/.ssh/ats_deploy`)

Quick steps:

1. Create an SSH keypair if you don't have one:

```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/ats_deploy
```

2. Run the deploy helper (public key path, git repo url, optional private key path):

```bash
./scripts/deploy.sh ~/.ssh/ats_deploy.pub git@github.com:youruser/yourrepo.git ~/.ssh/ats_deploy
```

3. Terraform will provision an EC2 instance and output its public IP. The script then runs Ansible to install Node.js, clone your repo, and start the app with `pm2`.

Notes:
- Update `terraform/variables.tf` defaults if you want a different region or instance type.
- The script assumes the app exposes HTTP on port 3000 (and also opens port 80). Adjust security group in `terraform/main.tf` if needed.
- If your repo is private, ensure the EC2 instance has access to the repository (use deploy keys or an SSH agent approach).
