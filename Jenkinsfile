pipeline {
    agent any

    environment {
        // EC2 IPs
        TOOLS_EC2_PUBLIC_IP  = '35.173.206.94'
        TOOLS_EC2_PRIVATE_IP = '10.0.1.254'

        APP_EC2_PUBLIC_IP    = '54.237.157.183'
        APP_EC2_PRIVATE_IP   = '10.0.1.170'

        DB_HOST = '10.0.3.11'

        // Repositories
        FRONTEND_REPO = 'huongnguyencode/devops-bootcamp-todolist-frontend'
        BACKEND_REPO  = 'huongnguyencode/devops-bootcamp-todolist-backend-api'

        // Docker Hub
        DOCKER_HUB_USER = 'huongcode'
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
                    string(credentialsId: 'dev-db-user', variable: 'DB_USER'),
                    string(credentialsId: 'dev-db-pass', variable: 'DB_PASS'),
                    sshUserPrivateKey(
                        credentialsId: 'app-ec2-ssh',
                        keyFileVariable: 'SSH_KEY',
                        usernameVariable: 'SSH_USER'
                    )
                ]) {
                    sh '''
                        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER"@${APP_EC2_PRIVATE_IP} "
                            echo '=== Deploying Backend ==='
                            docker stop todo-backend || true
                            docker rm todo-backend || true

                            docker pull ${DOCKER_HUB_USER}/todo-backend:latest

                            docker run -d \
                                --name todo-backend \
                                --restart unless-stopped \
                                -p 5000:5000 \
                                -e DATABASE_HOST=${DB_HOST} \
                                -e DATABASE_PORT=5432 \
                                -e DATABASE_NAME=devdb \
                                -e DATABASE_USER=$DB_USER \
                                -e DATABASE_PASSWORD=$DB_PASS \
                                -e PORT=5000 \
                                -e NODE_ENV=development \
                                ${DOCKER_HUB_USER}/todo-backend:latest

                            echo '=== Deploying Frontend ==='
                            docker stop todo-frontend || true
                            docker rm todo-frontend || true

                            docker pull ${DOCKER_HUB_USER}/todo-frontend:latest

                            docker run -d \
                                --name todo-frontend \
                                --restart unless-stopped \
                                -p 3000:3000 \
                                -e NEXT_PUBLIC_API_URL=http://${APP_EC2_PUBLIC_IP}:5000/api \
                                ${DOCKER_HUB_USER}/todo-frontend:latest
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
                export KUBECONFIG=/var/jenkins_home/secret-files/kubeconfig

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

                echo "=== Creating database secret ==="
                kubectl --kubeconfig=${KUBECONFIG} -n todolist delete secret db-secret --ignore-not-found=true
                kubectl --kubeconfig=${KUBECONFIG} -n todolist create secret generic db-secret \
                    --from-literal=username=produser \
                    --from-literal=password=${PROD_DB_PASS}

                echo "=== Deploying backend ==="
                kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/backend/configmap.yaml
                kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/backend/deployment.yaml
                kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/backend/service.yaml

                echo "=== Deploying frontend ==="
                kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/frontend/configmap.yaml
                kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/frontend/deployment.yaml
                kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/frontend/service.yaml

                echo "=== Applying ingress if exists ==="
                if [ -f k8s/ingress.yaml ]; then
                    kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/ingress.yaml
                else
                    echo "k8s/ingress.yaml not found, skipping ingress."
                fi

                echo "=== Deployment status ==="
                kubectl --kubeconfig=${KUBECONFIG} -n todolist get pods
                kubectl --kubeconfig=${KUBECONFIG} -n todolist get svc
            '''
        }
    }
}
    }

    post {
        always {
            cleanWs()
        }
    }
}