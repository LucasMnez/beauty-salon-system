FROM nginx:alpine

# Remove config default
RUN rm /etc/nginx/conf.d/default.conf

# Copia config custom
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia arquivos estáticos
COPY . /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
