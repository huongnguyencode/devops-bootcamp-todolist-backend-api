pipeline {
    agent any

    environment {
        // EC2 IPs
        TOOLS_EC2_PUBLIC_IP  = '35.173.206.94'
        TOOLS_EC2_PRIVATE_IP = '10.0.1.254'

        APP_EC2_PUBLIC_IP    = '54.237.157.183'
        APP_EC2_PRIVATE_IP   = '10.0.1.170'

        DATA_EC2_PRIVATE_IP  = '10.0.3.11'

        // GitHub repositories
        FRONTEND_REPO = 'huongnguyencode/devops-bootcamp-todolist-frontend'
        BACKEND_REPO  = 'huongnguyencode/devops-bootcamp-todolist-backend-api'

        // Docker Hub
        DOCKER_HUB_USER = 'huongcode'

        // Production kubeconfig mounted inside Jenkins container
        KUBECONFIG_PATH = '/var/jenkins_home/secret-files/kubeconfig'
    }

    stages {
        stage('Checkout') {
            steps {
                script {
                    deleteDir()
                }

                dir('frontend') {
                    git branch: 'master',
                        url: "https://github.com/${FRONTEND_REPO}.git",
                        credentialsId: 'github-cred'
                }

                dir('backend') {
                    git branch: 'master',
                        url: "https://github.com/${BACKEND_REPO}.git",
                        credentialsId: 'github-cred'
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    dir('frontend') {
                        sh '''
                            docker build \
                              -t ${DOCKER_HUB_USER}/todo-frontend:${GIT_COMMIT} \
                              -t ${DOCKER_HUB_USER}/todo-frontend:latest \
                              .
                        '''
                    }

                    dir('backend') {
                        sh '''
                            docker build \
                              -t ${DOCKER_HUB_USER}/todo-backend:${GIT_COMMIT} \
                              -t ${DOCKER_HUB_USER}/todo-backend:latest \
                              .
                        '''
                    }
                }
            }
        }

        stage('Push to Docker Hub') {
            when {
                branch 'master'
            }
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-cred',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )
                ]) {
                    sh '''
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin

                        docker push ${DOCKER_HUB_USER}/todo-frontend:${GIT_COMMIT}
                        docker push ${DOCKER_HUB_USER}/todo-frontend:latest

                        docker push ${DOCKER_HUB_USER}/todo-backend:${GIT_COMMIT}
                        docker push ${DOCKER_HUB_USER}/todo-backend:latest
                    '''
                }
            }
        }

        stage('Deploy to Dev') {
            when {
                branch 'master'
            }
            steps {
                withCredentials([
                    string(credentialsId: 'dev-db-user', variable: 'DEV_DB_USER'),
                    string(credentialsId: 'dev-db-pass', variable: 'DEV_DB_PASS'),
                    sshUserPrivateKey(
                        credentialsId: 'app-ec2-ssh',
                        keyFileVariable: 'SSH_KEY',
                        usernameVariable: 'SSH_USER'
                    )
                ]) {
                    sh '''
                        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER"@${APP_EC2_PRIVATE_IP} "
                            echo '=== Deploying Backend to Dev ==='

                            docker stop todo-backend || true
                            docker rm todo-backend || true
                            docker pull ${DOCKER_HUB_USER}/todo-backend:latest

                            docker run -d \
                              --name todo-backend \
                              --restart unless-stopped \
                              -p 5000:5000 \
                              -e DATABASE_HOST=${DATA_EC2_PRIVATE_IP} \
                              -e DATABASE_PORT=5432 \
                              -e DATABASE_NAME=devdb \
                              -e DATABASE_USER=${DEV_DB_USER} \
                              -e DATABASE_PASSWORD=${DEV_DB_PASS} \
                              -e PORT=5000 \
                              -e NODE_ENV=development \
                              ${DOCKER_HUB_USER}/todo-backend:latest

                            echo '=== Deploying Frontend to Dev ==='

                            docker stop todo-frontend || true
                            docker rm todo-frontend || true
                            docker pull ${DOCKER_HUB_USER}/todo-frontend:latest

                            docker run -d \
                              --name todo-frontend \
                              --restart unless-stopped \
                              -p 3000:3000 \
                              -e NEXT_PUBLIC_API_URL=http://${APP_EC2_PUBLIC_IP}:5000/api \
                              ${DOCKER_HUB_USER}/todo-frontend:latest

                            echo '=== Dev containers ==='
                            docker ps --filter name=todo-
                        "
                    '''
                }
            }
        }

        stage('Approval Gate') {
            when {
                branch 'master'
            }
            steps {
                input message: 'Deploy to Production?', ok: 'Approve'
            }
        }

        stage('Deploy to Production') {
            when {
                branch 'master'
            }
            steps {
                withCredentials([
                    string(credentialsId: 'prod-db-pass', variable: 'PROD_DB_PASS')
                ]) {
                    sh '''
                        export KUBECONFIG=${KUBECONFIG_PATH}

                        echo "=== Current workspace ==="
                        pwd
                        ls -lah

                        echo "=== Go to backend repo ==="
                        cd backend
                        pwd
                        ls -lah
                        ls -lah k8s

                        echo "=== Checking Kubernetes connection ==="
                        kubectl --kubeconfig=${KUBECONFIG} get nodes

                        echo "=== Applying namespace ==="
                        kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/namespace.yaml

                        echo "=== Creating PostgreSQL secret for production ==="
                        kubectl --kubeconfig=${KUBECONFIG} -n todolist delete secret postgres-secret --ignore-not-found=true
                        kubectl --kubeconfig=${KUBECONFIG} -n todolist create secret generic postgres-secret \
                          --from-literal=POSTGRES_USER=produser \
                          --from-literal=POSTGRES_PASSWORD=${PROD_DB_PASS}

                        echo "=== Applying backend manifests ==="
                        kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/backend/configmap.yaml
                        kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/backend/deployment.yaml
                        kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/backend/service.yaml

                        echo "=== Applying frontend manifests ==="
                        kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/frontend/configmap.yaml
                        kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/frontend/deployment.yaml
                        kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/frontend/service.yaml

                        echo "=== Applying ingress ==="
                        if [ -f k8s/ingress.yaml ]; then
                            kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/ingress.yaml
                        else
                            echo "k8s/ingress.yaml not found, skipping ingress."
                        fi

                        echo "=== Restarting deployments ==="
                        kubectl --kubeconfig=${KUBECONFIG} -n todolist rollout restart deployment/backend
                        kubectl --kubeconfig=${KUBECONFIG} -n todolist rollout restart deployment/frontend

                        echo "=== Waiting for frontend rollout ==="
                        kubectl --kubeconfig=${KUBECONFIG} -n todolist rollout status deployment/frontend --timeout=180s

                        echo "=== Waiting for backend rollout ==="
                        kubectl --kubeconfig=${KUBECONFIG} -n todolist rollout status deployment/backend --timeout=180s || true

                        echo "=== Kubernetes resources ==="
                        kubectl --kubeconfig=${KUBECONFIG} -n todolist get pods
                        kubectl --kubeconfig=${KUBECONFIG} -n todolist get svc
                        kubectl --kubeconfig=${KUBECONFIG} -n todolist get ingress || true

                        echo "=== Backend logs ==="
                        kubectl --kubeconfig=${KUBECONFIG} -n todolist logs -l app=backend --tail=80 || true

                        echo "=== Frontend logs ==="
                        kubectl --kubeconfig=${KUBECONFIG} -n todolist logs -l app=frontend --tail=40 || true
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully.'
        }

        failure {
            echo 'Pipeline failed. Check the failed stage logs above.'
        }

        always {
            cleanWs()
        }
    }
}