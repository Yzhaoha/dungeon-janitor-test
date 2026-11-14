import sys
head=open('head.html').read()
loader='''<script>
(function(){
  function go(T){ window.THREE=T; var s=document.createElement('script'); s.textContent=document.getElementById('gamesrc').textContent; document.body.appendChild(s); }
  import('./three.module.min.js').then(go).catch(function(){ return import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js').then(go); });
})();
</script>'''
body=head+'<script id="gamesrc" type="text/plain">\n'+open('sim.js').read()+'\n'+open('i18n.js').read()+'\n'+open('game.js').read()+'\n</script>\n'+loader+'\n</body>\n</html>\n'
open('index.html','w').write(body)
print(len(body))
