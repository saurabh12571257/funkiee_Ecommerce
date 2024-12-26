variable "aws_region" {
  description = "AWS region"
  default     = "us-west-2"
}

variable "ami_id" {
  description = "AMI ID for EC2 instance"
  # Ubuntu 22.04 LTS AMI ID
  default = "ami-053b12d3152c0cc71"
}

variable "key_name" {
  description = "Name of the SSH key pair"
}

variable "db_username" {
  description = "Existing RDS username"
}

variable "db_password" {
  description = "Existing RDS password"
}

variable "db_endpoint" {
  description = "Existing RDS endpoint"
}

variable "db_name" {
  description = "Existing RDS database name"
}

variable "jwt_secret" {
  description = "JWT secret key"
}

variable "docker_image" {
  description = "Docker image to deploy"
} 