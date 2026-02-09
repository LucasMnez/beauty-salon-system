FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

# caminho correto
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# arquivos estáticos
COPY frontend/ /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
