import socket
import ssl
import gzip
import tkinter
from tkinter import BOTH
from tkinter import *

WIDTH, HEIGHT = 800, 600
WIDTH, HEIGHT = 800, 600
HSTEP, VSTEP = 13, 18
SCROLL_STEP = 100
cache = {}

class URL:
    def __init__(self, url):
        self.url_string = url 
        # file page 
        if url.startswith("file://"):
            self.scheme = "file"
            self.path = url[len("file://"):]
            if self.path == "":
                self.path = "/"
            return
        # custom html page
        if url.startswith("data:text/html,"):
            self.scheme = "data"
            self.data = url[len("data:text/html,"):]
            return
        #about blank page
        if url.startswith("about:blank"):
            self.scheme = "about-blank"
            # self.data = ""
            return 
        # view source page
        if url.startswith("view-source:"):
            self.scheme = "view-source"
            inner = url[len("view-source:"):]
            if "://" not in inner:
                inner = "http://" + inner
            self.inner_url = URL(inner)            
            return
        # normal http, https rendering
        try:
            self.scheme, url = url.split("://", 1)
            assert self.scheme in ["http", "https"]
            if "/" not in url:
                url = url + "/"
            self.host, url = url.split("/", 1)
            self.path = "/" + url
            if self.scheme == "http":
                self.port = 80
            elif self.scheme == "https":
                self.port = 443
            # custom port 
            if ":" in self.host:
                self.host, port = self.host.split(":", 1)
                self.port = int(port)
        except Exception as e:
            self.scheme = "about-blank"

    # request definition
    def request(self, redirect_count=0):
        # caching
        if self.scheme in ["http", "https"] and self.url_string in cache:
            return cache[self.url_string]["content"]

        # return raw source
        if self.scheme == "view-source":
            return self.inner_url.request()
        # return file
        if self.scheme == "file":
            path = self.path
            if (
              path.startswith("/") and
              len(path) > 2 and
              path[1].isalpha() and
              path[2] == ":"
            ):
              path = path[1:]
            with open(path, encoding="utf8") as f:
                return f.read()
        # return html data you inputted   
        if self.scheme == "data":
            return self.data

        # starting connection 
        s = socket.socket(
            family=socket.AF_INET, 
            type=socket.SOCK_STREAM,
            proto=socket.IPPROTO_TCP,
        )
        try: 
            s.connect((self.host, self.port))
        except: 
            self.scheme = "about-blank"
            return URL("about:blank").request
        
        if self.scheme == "about-blank":
            return ""
        
        if self.scheme == "https":
            ctx = ssl.create_default_context()
            s = ctx.wrap_socket(s, server_hostname=self.host)
        # headers for request
        headers = {
        "Host": self.host,
        "Connection": "close",
        "User-Agent": "MySimpleBrowser/1.1",
        "Accept-Encoding": "gzip",
        }
        # request itself
        request = "GET {} HTTP/1.1\r\n".format(self.path)
        for header, value in headers.items():
            request += f"{header}: {value}\r\n"
        request += "\r\n"
        
        s.send(request.encode("utf8"))
        response = s.makefile("rb")  # Always open as bytes
        statusline = response.readline().decode("utf8")
        version, status, explanation = statusline.split(" ", 2)
        response_headers = {}
        # read normal utf8 data 
        while True:
            line = response.readline().decode("utf8")
            if line == "\r\n": break
            header, value = line.split(":", 1)
            response_headers[header.casefold()] = value.strip()

        if status.startswith("3") and "location" in response_headers and redirect_count < 10:            
            new_url = response_headers["location"]
            if new_url.startswith("/"):
                new_url = f"{self.scheme}://{self.host}{new_url}"
            return URL(new_url).request(redirect_count + 1)

        if response_headers.get("transfer-encoding") == "chunked":
            # Read and decode chunked body
            body = b""
            while True:
                # Each chunk starts with its length in hex, ending with \r\n
                line = response.readline()
                chunk_size = int(line.strip(), 16)
                if chunk_size == 0:
                    break
                chunk = response.read(chunk_size)
                body += chunk
                response.read(2)  # Read the trailing \r\n after each chunk
            if response_headers.get("content-encoding") == "gzip":
                content = gzip.decompress(body).decode("utf8")
            else:
                content = body.decode("utf8")
        else:
            if response_headers.get("content-encoding") == "gzip":
                raw = response.read()
                content = gzip.decompress(raw).decode("utf8")
            else:
                content = response.read().decode("utf8")
            cache_control = response_headers.get("cache-control", "")
            directives = [d.strip() for d in cache_control.split(",") if d.strip()]
            allowed = {"no-store", "max-age"}

            if status == "200" and all(d.startswith("max-age") or d == "no-store" for d in directives):
                cache[self.url_string] = {
                    "content": content,
                }
        s.close()
        return content

def lex(body):
    if url.scheme == "about-blank":
        text = "Error rendering page"
        return text
    body = body.replace("&lt;", "<").replace("&gt;", ">")
    in_tag = False
    text = ""
    for c in body:
        if c == "<":
            in_tag = True
        elif c == ">":
            in_tag = False
        elif not in_tag:
            text += c
    return text

# show html page content by printing
#def show(body):
    body = body.replace("&lt;", "<").replace("&gt;", ">")
    in_tag = False
    for c in body:
        if c == "<":
            in_tag = True
        elif c == ">":
            in_tag = False
        elif not in_tag:
            print(c, end="")

#def load(url):
    body = url.request()
    show(body)

def layout(text):
    display_list = []
    cursor_x, cursor_y = HSTEP, VSTEP
    for c in text:
        if c == "\n":
            cursor_y += VSTEP * 2
            cursor_x = HSTEP
        else: 
            display_list.append((cursor_x, cursor_y, c))
            cursor_x += HSTEP
            if cursor_x >= WIDTH - HSTEP:
                cursor_y += VSTEP
                cursor_x = HSTEP
    return display_list

class Browser:
    def draw(self):
        self.canvas.delete("all")
        # draw characters
        for x, y, c in self.display_list:
            if y > self.scroll + HEIGHT: continue
            if y + VSTEP < self.scroll: continue
            self.canvas.create_text(x, y - self.scroll, text=c)
        # draw scrollbar 
        if self.display_list:
            max_y = max(y for x, y, c in self.display_list)
            doc_height = max_y + VSTEP
            if doc_height > HEIGHT:
                bar_height = HEIGHT * HEIGHT // doc_height
                bar_top = self.scroll * HEIGHT // doc_height
                bar_left = WIDTH - 10
                self.canvas.create_rectangle(
                    bar_left, bar_top,
                    bar_left + 10, bar_top + bar_height,
                    fill="blue"
                )
    def __init__(self):
        self.emoji_cache = {}
        self.window = tkinter.Tk()
        self.canvas = tkinter.Canvas(
            self.window,
            width=WIDTH,
            height=HEIGHT,
        )
        self.canvas.pack(fill=BOTH, expand=1,)
        self.scroll = 0
        
        self.window.bind("<Configure>", self.on_resize)
        self.window.bind("<MouseWheel>", self.on_mousewheel)
        self.window.bind("<Up>", self.scrollup)
        self.window.bind("<Down>", self.scrolldown)

    def load(self, url):
        body = url.request()
        text = lex(body)
        self.text = text
        self.display_list = layout(text)
        self.draw()

    def scrolldown(self, e):
        self.scroll += SCROLL_STEP
        if self.display_list:
            max_y = max(y for x, y, c in self.display_list)
            doc_height = max_y + VSTEP
            max_scroll = max(0, doc_height - HEIGHT)
            if self.scroll > max_scroll:
                self.scroll = max_scroll
        self.draw()

    def scrollup(self, e):
        self.scroll -=SCROLL_STEP
        if self.scroll < 0:
            self.scroll = 0
        self.draw()
    
    def on_resize(self, event):
        global WIDTH
        global HEIGHT
        WIDTH = event.width
        HEIGHT = event.height
        if hasattr(self, "display_list"):
            self.display_list = layout(self.text)
            self.draw()

    def on_mousewheel(self, event):
        if event.delta > 0:
            self.scrollup(event)
        else:
            self.scrolldown(event)
            
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        url = URL(sys.argv[1])
    else:
        url = URL("file:///C:/Users/desli/Documents/projects/Webbrowser/test.html")
    # Choose one: GUI or terminal output
    # For GUI:
    browser = Browser()
    browser.load(url)
    tkinter.mainloop()
    # For terminal:
    #load(url)
