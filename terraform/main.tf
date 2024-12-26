terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Security Group for EC2
resource "aws_security_group" "ec2" {
  name        = "travel-tracker-ec2-sg"
  description = "Security group for EC2 instance"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Add PostgreSQL port rule
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # ⚠️ Consider restricting this in production
  }

  # Existing egress rule
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# EC2 Instance
resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = "t2.micro"
  vpc_security_group_ids = [aws_security_group.ec2.id]
  key_name              = var.key_name

  user_data = <<-EOF
              #!/bin/bash
              sudo apt-get update
              sudo apt-get install -y docker.io
              sudo systemctl start docker
              sudo systemctl enable docker
              
              # Create environment file
              cat > /home/ubuntu/.env << 'EOL'
              DB_USER=${var.db_username}
              DB_PASS=${var.db_password}
              DB_HOST=${var.db_endpoint}
              DB_NAME=${var.db_name}
              EOL
              
              sudo docker pull ${var.docker_image}
              sudo docker run -d \
                --name nodecontainer \
                -p 3000:3000 \
                --env-file /home/ubuntu/.env \
                ${var.docker_image}
              EOF

  tags = {
    Name = "travel-tracker-app"
  }
} 