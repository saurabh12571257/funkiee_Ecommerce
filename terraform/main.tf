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

# Security Group for EC2 instances
resource "aws_security_group" "ec2" {
  name        = "travel-tracker-ec2-sg"
  description = "Security group for EC2 instances"

  # Allow inbound traffic from ALB
  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Allow SSH access
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Consider restricting to your IP
  }

  # Single egress rule for all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "travel-tracker-ec2-sg"
  }
}

# Launch Template
resource "aws_launch_template" "app" {
  name_prefix   = "travel-tracker-template"
  image_id      = var.ami_id
  instance_type = "t2.micro"

  network_interfaces {
    associate_public_ip_address = true
    security_groups            = [aws_security_group.ec2.id]
  }

  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    db_username  = var.db_username
    db_password  = var.db_password
    db_endpoint  = var.db_endpoint
    db_name      = var.db_name
    jwt_secret   = var.jwt_secret
    docker_image = var.docker_image
  }))

  key_name = var.key_name

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "travel-tracker-app"
    }
  }
}

# Auto Scaling Group
resource "aws_autoscaling_group" "app" {
  name                = "travel-tracker-asg"
  desired_capacity    = 1
  max_size           = 3
  min_size           = 1
  target_group_arns  = [aws_lb_target_group.app.arn]
  vpc_zone_identifier = data.aws_subnets.default.ids

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "travel-tracker-app"
    propagate_at_launch = true
  }
}

# Application Load Balancer
resource "aws_lb" "app" {
  name               = "travel-tracker-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets           = slice(data.aws_subnets.default.ids, 0, 2)

  tags = {
    Name = "travel-tracker-alb"
  }
}

# ALB Target Group
resource "aws_lb_target_group" "app" {
  name     = "travel-tracker-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = data.aws_vpc.default.id

  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 10
  }
}

# ALB Listener
resource "aws_lb_listener" "app" {
  load_balancer_arn = aws_lb.app.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# ALB Security Group
resource "aws_security_group" "alb" {
  name        = "travel-tracker-alb-sg"
  description = "Security group for ALB"

  ingress {
    from_port   = 80
    to_port     = 80
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

# Data sources for VPC and Subnets
data "aws_vpc" "default" {
  default = true
}

# Get availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Get subnets from different AZs
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Get specific subnet details
data "aws_subnet" "selected" {
  for_each = toset(slice(data.aws_subnets.default.ids, 0, 2))
  id       = each.value
}

# Instead of adding a new rule, let's modify the existing RDS security group
resource "aws_security_group_rule" "rds_ingress_ec2" {
  count = length(var.rds_security_group_ids)

  type                     = "ingress"
  from_port               = 5432
  to_port                 = 5432
  protocol                = "tcp"
  source_security_group_id = aws_security_group.ec2.id
  security_group_id       = var.rds_security_group_ids[count.index]
  description             = "Allow PostgreSQL from EC2 instances"
} 