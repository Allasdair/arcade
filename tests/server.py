"""Test server that can misbehave. Reads /tmp/mode on every request:
  up          normal
  hang        every request stalls for 20 s (wifi connected, internet down)
  fail:<txt>  any path containing <txt> returns 500 (an update that breaks halfway)
Logs each path to /tmp/req.log."""
import http.server, os, time, sys
os.chdir(sys.argv[1])
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
    def end_headers(self): self.send_header('Cache-Control','no-cache'); super().end_headers()
    def do_GET(self):
        m=open('/tmp/mode').read().strip() if os.path.exists('/tmp/mode') else 'up'
        open('/tmp/req.log','a').write(f'{time.time():.1f} {self.path}\n')
        if m=='hang': time.sleep(20)
        if m.startswith('fail:') and m[5:] in self.path: return self.send_error(500)
        return super().do_GET()
http.server.ThreadingHTTPServer(('127.0.0.1',int(sys.argv[2]) if len(sys.argv)>2 else 8770),H).serve_forever()
