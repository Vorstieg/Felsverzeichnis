FROM mcr.microsoft.com/playwright:v1.62.1-noble

# The workspace is bind-mounted from the host, where the primary developer
# account uses UID/GID 1000. Match that identity so code-server can edit it.
USER root
RUN userdel ubuntu \
	&& groupmod --gid 1000 pwuser \
	&& usermod --uid 1000 --gid 1000 pwuser

ENV BASE_PATH=/absproxy/5173
ENV VSCODE_PROXY_URI=http://localhost:8080/absproxy/{{port}}

USER pwuser
