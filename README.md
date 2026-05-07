markdown
# 3-Tier Application Deployment on AWS with CI/CD and Observability

## Overview

This project demonstrates an end-to-end DevOps workflow for deploying a 3-tier To-Do List application on AWS.

The system includes:

- Frontend application
- Backend API
- PostgreSQL database
- Jenkins CI/CD pipeline
- Docker-based Dev deployment
- Kubernetes Kind Production deployment
- Observability stack with Prometheus, Grafana, Loki, Promtail, Node Exporter, and cAdvisor

The main goal is to automate application delivery, separate Dev and Production environments, secure database access, and monitor the system with metrics and logs.

---
## Architecture
The infrastructure is deployed inside a custom AWS VPC.
```text
Developer
   ↓
GitHub
   ↓
Jenkins
   ↓
Docker Build
   ↓
Docker Hub
   ↓
Dev Deployment on App EC2
   ↓
Manual Approval
   ↓
Production Deployment on Kubernetes Kind
   ↓
Monitoring with Prometheus, Loki, and Grafana
# 1. Infrastructure Design

## 1.1 Network Architecture

* Custom VPC
* 2 Public Subnets across 2 Availability Zones
* 2 Private Subnets across 2 Availability Zones
* Internet Gateway for public subnet access
* NAT Gateway for private subnet outbound access
* Public Route Table: `0.0.0.0/0 -> Internet Gateway`
* Private Route Table: `0.0.0.0/0 -> NAT Gateway`

### Why this design?

* Public subnets are used for Internet-facing services such as Jenkins, Grafana, and the Dev application server.
* Private subnets are used for the PostgreSQL database to prevent direct Internet access.
* Multi-AZ subnet design improves availability and follows cloud architecture best practices.
* A single NAT Gateway is used in this lab to optimize AWS cost, while production environments should use one NAT Gateway per Availability Zone.

---

# 2. EC2 Infrastructure

| EC2 Instance | Subnet         | Purpose                                             |
| ------------ | -------------- | --------------------------------------------------- |
| Tools EC2    | Public Subnet  | Jenkins, Prometheus, Grafana, Loki, Kubernetes Kind |
| App EC2      | Public Subnet  | Dockerized Frontend and Backend for Dev             |
| Database EC2 | Private Subnet | PostgreSQL Database                                 |

## 2.1 Why EC2?

* Practice real infrastructure operations
* Linux server administration
* Docker installation and deployment
* Jenkins hosting
* Kubernetes Kind setup
* PostgreSQL deployment
* Monitoring stack configuration

### Production Recommendation

* Replace self-managed services with managed services such as:

  * Amazon RDS
  * AWS EKS

---

# 3. Security Design

## 3.1 Network Security

* Database EC2 is deployed in a private subnet
* PostgreSQL is not publicly accessible
* Public-facing services are hosted in public subnets
* Private subnet outbound traffic routes through NAT Gateway

## 3.2 Security Groups

| Security Group | Purpose                                                           |
| -------------- | ----------------------------------------------------------------- |
| SG-Tools       | Access control for Jenkins, Grafana, Prometheus, Loki             |
| SG-App         | Application traffic for Frontend and Backend                      |
| SG-DB          | Allows PostgreSQL access only from App EC2 and Production Backend |

## 3.3 Credentials Management

* Dev database credentials stored in Jenkins Credentials
* Production credentials stored in Kubernetes Secrets
* No database passwords committed to GitHub

### Why this design?

* Follows the Principle of Least Privilege
* Restricts unnecessary communication
* Protects sensitive credentials from source code exposure

---

# 4. CI/CD Pipeline

## 4.1 Pipeline Flow

1. Checkout Source Code
2. Build Docker Images
3. Run Tests
4. Push Images to Docker Hub
5. Deploy to Dev
6. Manual Approval
7. Deploy to Production

## 4.2 Why Jenkins?

* Widely used CI/CD automation tool
* Full control over:

  * Build stages
  * Testing
  * Deployment
  * Credentials
  * Approval workflows

## 4.3 Benefits

* Reduces manual deployment effort
* Standardizes deployment process
* Detects errors earlier
* Supports manual approval before Production
* Secures credentials using Jenkins Credentials

---

# 5. Docker Deployment

## 5.1 Containerization

* Frontend and Backend are packaged as Docker images

## 5.2 Why Docker?

* Ensures environment consistency
* Same image used across environments:

  * Dev on App EC2
  * Production on Kubernetes Kind

## 5.3 Benefits

* Consistent runtime environment
* Easier deployment
* Easier rollback using image tags
* Better CI/CD integration
* Dependencies packaged with the application

---

# 6. Development Environment Deployment

## 6.1 Deployment Flow

Jenkins
↓ SSH
App EC2
↓
Pull Docker Images
↓
Run Frontend and Backend Containers
↓
Backend connects to PostgreSQL

---

# 7. Production Deployment with Kubernetes Kind

## 7.1 Overview

* Production environment runs on Kubernetes Kind inside Tools EC2
* Kind = Kubernetes in Docker
* Used for cost-efficient Kubernetes practice

## 7.2 Kubernetes Objects

| Object     | Purpose                           |
| ---------- | --------------------------------- |
| Namespace  | Resource isolation                |
| ConfigMap  | Store non-sensitive configuration |
| Secret     | Store database credentials        |
| Deployment | Manage Frontend and Backend Pods  |
| Service    | Internal Pod communication        |
| NodePort   | External Frontend access          |

## 7.3 Production Flow

Docker Hub
↓
Kubernetes Deployment
↓
Frontend Pod
↓
Backend Service
↓
Backend Pod
↓
PostgreSQL on Database EC2

## 7.4 Why Kubernetes Kind?

* Practice Kubernetes without managed service cost
* Supports:

  * Pods
  * Deployments
  * Services
  * ConfigMaps
  * Secrets

## 7.5 Benefits

* Production-like workflow
* Pod self-healing
* Easier application updates
* Preparation for migration to AWS EKS

## 7.6 Limitation

* Suitable for lab/demo only
* AWS EKS recommended for real production workloads

---

# 8. Observability Stack

## 8.1 Components

* Prometheus
* Grafana
* cAdvisor
* Node Exporter
* Loki
* Promtail
* Log Generator

## 8.2 Exposed Ports

| Service       | Port |
| ------------- | ---- |
| Grafana       | 3000 |
| Prometheus    | 9090 |
| cAdvisor      | 8080 |
| Node Exporter | 9100 |
| Loki          | 3100 |
| Promtail      | 9080 |

---

# 9. Metrics and Logging Flow

## 9.1 Metrics Flow

Node Exporter
cAdvisor
Backend `/metrics`
↓
Prometheus
↓
Grafana

## 9.2 Logs Flow

Application Logs
Docker Container Logs
System Logs
↓
Promtail
↓
Loki
↓
Grafana

---

# 10. Monitoring Tools Explanation

## 10.1 Prometheus

Used for metrics collection and storage.

### Example Metrics

* CPU usage
* Memory usage
* Disk usage
* Request count
* Error rate
* API latency

---

## 10.2 Node Exporter

Collects host-level metrics from EC2 instances.

### Monitors

* CPU
* RAM
* Disk
* Network

---

## 10.3 cAdvisor

Collects container-level metrics.

### Monitors

* Container CPU usage
* Container memory usage
* Network traffic
* Container status

---

## 10.4 Loki

Stores and queries logs.

### Purpose

* Investigate failures
* Centralized log management

---

## 10.5 Promtail

Collects logs from:

* Containers
* System logs

Then forwards logs to Loki.

---

## 10.6 Grafana

Visualization platform connected to:

* Prometheus for metrics
* Loki for logs

### Benefits

* Centralized dashboards
* Real-time visibility
* Easier debugging
* Unified metrics and logs

---

# 11. Useful Commands

## 11.1 Start Observability Stack

```bash
docker-compose up -d
```

## 11.2 View Running Containers

```bash
docker ps
```

## 11.3 View Service Logs

```bash
docker-compose logs -f
```

## 11.4 Stop Services

```bash
docker-compose down
```

## 11.5 Remove Services and Volumes

```bash
docker-compose down -v
```

## 11.6 Restart Prometheus

```bash
docker-compose restart prometheus
```

---

# 12. Grafana Dashboards

| Dashboard                | Purpose                            |
| ------------------------ | ---------------------------------- |
| Node Exporter Full       | EC2 metrics                        |
| Docker Container Metrics | Container resource usage           |
| cAdvisor Dashboard       | Container monitoring               |
| Loki Logs Dashboard      | Centralized logs                   |
| Application Dashboard    | Request count, latency, error rate |

## 12.1 Example Dashboard IDs

* Node Exporter Full: 1860
* Docker Container & Host Metrics: 179
* cAdvisor: 893
* Loki Stack Monitoring: 14055
* Loki Logs Dashboard: 13639
* Container Logs: 15141

---

# 13. Project Achievements

## 13.1 Infrastructure

* AWS VPC with public/private subnet architecture
* Internet Gateway and NAT Gateway
* Route Tables
* EC2 infrastructure for tools, app, and database

## 13.2 Security

* Security Group isolation
* Database protection in private subnet
* Credential management

## 13.3 DevOps & Deployment

* Dockerized Frontend and Backend
* Jenkins CI/CD Pipeline
* Docker Hub integration
* Dev deployment using Docker
* Production deployment using Kubernetes Kind

## 13.4 Kubernetes

* Namespace
* ConfigMap
* Secret
* Deployment
* Service
* NodePort

## 13.5 Monitoring & Logging

* Prometheus metrics collection
* Loki log aggregation
* Promtail log shipping
* Grafana dashboards
