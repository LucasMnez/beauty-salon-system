FROM nginx:alpine

# Remove config default
RUN rm -rf /usr/share/nginx/html/*

# Copia HTML, JS, CSS
COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
