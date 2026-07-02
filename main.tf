terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# ── SSH Key Pair ──────────────────────────────────────────────────────────────

variable "public_key_path" {
  description = "Path to your local SSH public key file"
  type        = string
  default     = "~/.ssh/ats-be-key.pub"
}

resource "aws_key_pair" "ats_be_key" {
  key_name   = "ats-be-key"
  public_key = file(var.public_key_path)
}

# ── Security Group ────────────────────────────────────────────────────────────

resource "aws_security_group" "ats_be_sg" {
  name        = "ats-be-sg"
  description = "Allow web traffic to ats-be application"

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── EC2 Instance ──────────────────────────────────────────────────────────────

locals {
  env_b64 = base64encode(file("${path.module}/.env"))
}

resource "aws_instance" "ats_be_server" {
  ami           = "ami-0c7217cdde317cfec" # Ubuntu 22.04 LTS (us-east-1)
  instance_type = "t2.micro"

  key_name               = aws_key_pair.ats_be_key.key_name
  vpc_security_group_ids = [aws_security_group.ats_be_sg.id]

  user_data = <<-EOF
    #!/bin/bash
    set -e
    apt-get update -y
    apt-get install -y docker.io git
    systemctl start docker
    systemctl enable docker

    cd /home/ubuntu
    git clone https://github.com/rocky07/ats-be.git ats-be
    cd ats-be

    # Write .env from base64-encoded content baked in at terraform apply time
    echo "${local.env_b64}" | base64 -d > /home/ubuntu/ats-be/.env

    docker build -t ats-be-image .
    docker run -d -p 3000:3000 \
      --env-file /home/ubuntu/ats-be/.env \
      --name ats-be-container \
      --restart always \
      ats-be-image
  EOF

  tags = {
    Name = "ats-be-server"
  }
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "ats_be_public_url" {
  value       = "http://${aws_instance.ats_be_server.public_ip}:3000"
  description = "Public URL of the ats-be application"
}

output "ssh_connect_command" {
  value       = "ssh -i ~/.ssh/ats-be-key ubuntu@${aws_instance.ats_be_server.public_ip}"
  description = "Ready-to-run SSH command to connect to your instance"
}
