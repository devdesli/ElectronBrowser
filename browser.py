import socket
import ssl
import gzip
import tkinter
from tkinter import BOTH
from tkinter import *
import os 
import tkinter.font

class Text:
    def __init__(self, text):
        self.text = text

class Tag:
    def __init__(self, tag):
        self.tag = tag

def emoji_filename(c):
    return os.path.join("resized_emojis", f"emoji_{ord(c):04X}_16x16.png")

WIDTH, HEIGHT = 800, 600
WIDTH, HEIGHT = 800, 600
HSTEP, VSTEP = 13, 20
original_HSTEP, original_VSTEP = 13, 18
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
            return URL("about:blank").request()
        
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

def decode_html_entities(text):
    """
    Decode common HTML entities to their character equivalents
    """
    # Common HTML entities
    entities = {
        '&lt;': '<',
        '&gt;': '>',
        '&amp;': '&',
        '&quot;': '"',
        '&apos;': "'",
        '&#39;': "'",
        '&nbsp;': ' ',  # Non-breaking space
        '&copy;': '©',
        '&reg;': '®',
        '&trade;': '™',
        '&hellip;': '…',
        '&mdash;': '—',
        '&ndash;': '–',
        '&ldquo;': '"',
        '&rdquo;': '"',
        '&lsquo;': ''',
        '&rsquo;': ''',
    }
    
    # Replace entities
    for entity, char in entities.items():
        text = text.replace(entity, char)
    
        return text
    
def lex(body, url_scheme):
    # Error route
    if url_scheme == "about-blank":
        return [Text("Error rendering page")]
    
    body = decode_html_entities(body)
    out = []
    buffer = ""
    in_tag = False
    
    for c in body:
        if c == "<":
            in_tag = True
            if buffer:  # Only add non-empty text
                out.append(Text(buffer))
            buffer = ""
        elif c == ">":
            in_tag = False
            if buffer:  # Only add non-empty tags
                out.append(Tag(buffer))
            buffer = ""
        else:
            buffer += c
    
    # Handle any remaining text after the loop
    if buffer:
        if in_tag:
            # Unclosed tag - you might want to handle this as an error
            out.append(Tag(buffer))
        else:
            out.append(Text(buffer))
    
    return out

def is_emoji(c):
    code = ord(c)
    return 0x1F300 <= code <= 0x1FAFF or 0x2600 <= code <= 0x26FF or 0x2700 <= code <= 0x27BF


class Layout:
    def __init__(self, tokens, rtl=False):
        self.display_list = []
        self.cursor_x = WIDTH - HSTEP if rtl else HSTEP
        self.cursor_y = VSTEP
        self.weight = "normal"
        self.style = "roman"
        self.size = 16
        self.rtl = rtl
        
        for tok in tokens:
            self.token(tok)
    
    def token(self, tok):
        if isinstance(tok, Text):
            # Handle text tokens - split by newlines first
            lines = tok.text.split('\n')
            
            for i, line_content in enumerate(lines):
                words = line_content.split()
                
                # Handle empty lines
                if not words and line_content.strip() == '':
                    if i > 0 or line_content != '':
                        self.cursor_y += VSTEP
                    self.cursor_x = WIDTH - HSTEP if self.rtl else HSTEP
                    continue
                
                # Process each word in the line
                for word_idx, word in enumerate(words):
                    self.word(word, is_last_word=(word_idx == len(words) - 1))
                
                # Handle newlines between line segments
                if i < len(lines) - 1:
                    self.cursor_y += VSTEP
                    self.cursor_x = WIDTH - HSTEP if self.rtl else HSTEP
                    
        elif isinstance(tok, Tag):
            # Handle tag tokens for styling
            if tok.tag == "i":
                self.style = "italic"
            elif tok.tag == "/i":
                self.style = "roman"
            elif tok.tag == "b":
                self.weight = "bold"
            elif tok.tag == "/b":
                self.weight = "normal"
            elif tok.tag == "small":
                self.size -= 2
            elif tok.tag == "/small":
                self.size += 2
            elif tok.tag == "big":
                self.size += 4
            elif tok.tag == "/big":
                self.size -= 4
            elif tok.tag == "br" or tok.tag == "p" or tok.tag == "div":
                self.cursor_y += VSTEP
                self.cursor_x = WIDTH - HSTEP if self.rtl else HSTEP
    
    def word(self, word, is_last_word=False):
        font = tkinter.font.Font(
            size=self.size,
            weight=self.weight,
            slant=self.style,
        )
        w = font.measure(word)
        
        # Check if word fits on current line, considering direction
        if self.rtl:
            # If word doesn't fit, move to a new line
            if self.cursor_x - w < HSTEP:
                self.cursor_y += VSTEP
                self.cursor_x = WIDTH - HSTEP
            
            # Place each character in the word (RTL: right to left)
            for c in word:
                char_kind = "emoji" if is_emoji(c) else "text"
                char_step = 16 if char_kind == "emoji" else font.measure(c)
                self.cursor_x -= char_step
                self.display_list.append((self.cursor_x, self.cursor_y, c, char_kind, font))
            
            # Add space after word (except for last word in line)
            if not is_last_word:
                self.cursor_x -= font.measure(' ')
            
        else: # LTR
            # If word doesn't fit, move to a new line
            if self.cursor_x + w > WIDTH - HSTEP:
                self.cursor_y += VSTEP
                self.cursor_x = HSTEP
            
            # Place each character in the word (LTR: left to right)
            for c in word:
                char_kind = "emoji" if is_emoji(c) else "text"
                char_step = 16 if char_kind == "emoji" else font.measure(c)
                self.display_list.append((self.cursor_x, self.cursor_y, c, char_kind, font))
                self.cursor_x += char_step
            
            # Add space after word (except for last word in line)
            if not is_last_word:
                self.cursor_x += font.measure(' ')

# Keep the old layout function for backward compatibility
def layout(tokens, rtl=False):
    """
    function that creates a Layout instance and returns the display list.
    """
    layout_obj = Layout(tokens, rtl)
    return layout_obj.display_list


class Browser:
    def draw(self):
        self.canvas.delete("all")
        # draw characters
        for x, y, c, kind, font in self.display_list:
            if y > self.scroll + HEIGHT: continue
            if y + VSTEP < self.scroll: continue
            if kind == "emoji":
                filename = emoji_filename(c)
                if filename not in self.emoji_cache:
                    if os.path.exists(filename):
                        img = tkinter.PhotoImage(file=filename)
                        self.emoji_cache[filename] = img
                    else:
                        self.emoji_cache[filename] = None
                if self.emoji_cache[filename]:
                    self.canvas.create_image(x, y - self.scroll, anchor="nw", image=self.emoji_cache[filename])
                else:
                    self.canvas.create_text(x, y - self.scroll, text=c, font=font) # Use the font here for non-emoji
            else:
                self.canvas.create_text(x, y - self.scroll, text=c, font=font) # Use the font here
        # draw scrollbar
        if self.display_list:
            max_y = max(y for x, y, c, kind, font in self.display_list)
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
    def __init__(self, rtl=False):
        self.emoji_cache = {}
        self.rtl = rtl
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
        self.tokens = lex(body, url.scheme) # Pass url.scheme to lex
        self.display_list = layout(self.tokens, rtl=self.rtl)
        self.draw()

    def scrolldown(self, e):
        self.scroll += SCROLL_STEP
        if self.display_list:
            max_y = max(y for x, y, c, kind, font in self.display_list)
            doc_height = max_y + VSTEP
            max_scroll = max(0, doc_height - HEIGHT)
            if self.scroll > max_scroll:
                self.scroll = max_scroll
        self.draw()

    def scrollup(self, e):
        self.scroll -=SCROLL_STEP
        if self.display_list:
            max_y = max(y for x, y, c, kind, font in self.display_list)
            doc_height = max_y + VSTEP
            max_scroll = max(0, doc_height - HEIGHT)
            if self.scroll > max_scroll:
                self.scroll = max_scroll
        if self.scroll < 0:
            self.scroll = 0
        self.draw()
    
    def on_resize(self, event):
        global WIDTH
        global HEIGHT
        WIDTH = event.width
        HEIGHT = event.height
        if hasattr(self, "tokens"):
            self.display_list = layout(self.tokens, rtl=self.rtl)
            self.draw()

    def on_mousewheel(self, event):
        if event.delta > 0:
            self.scrollup(event)
        else:
            self.scrolldown(event)
            
if __name__ == "__main__":
    import sys
    rtl = False
    args = sys.argv[1:]
    if "--rtl" in args:
        rtl = True
        args.remove("--rtl")
    if args:
        url = URL(args[0])
    else:
        url = URL("file:///C:/Users/desli/Documents/projects/Webbrowser/test.html")
    browser = Browser(rtl=rtl)
    browser.load(url)
    tkinter.mainloop()
    # For terminal:
    #load(url)
