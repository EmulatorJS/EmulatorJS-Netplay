<html>
    <head>
        <title>Emulatorjs | Netplay Server</title>
        <link rel="icon" type="image/png" href="img/Emulatorjs Logo.png">
    </head>
    <body>
        <h1>Emuserver - EmulatorJS</h1>
        <img width="200px" src="img/Emulatorjs Logo.png"><br>
        <hr>
        <h3>Start/Stop Server</h3><button onclick="startbutton()" id="startStop"></button>
        <p id="status"></p>
        <p id="nuser"></p>
        <br>
        <p>URL to use with emulatorjs</p>
        <ul id="urls">
        </ul>
        <br>
        <p><a href="https://github.com/ethanaobrien/emuserver">View on github</a></p>
        <p>Licenced under the Apache License 2.0</p>
        <p><a href="https://github.com/ethanaobrien/emuserver/blob/main/LICENSE">Read the whole license here</a></p>
        <script> 
            var startstop = document.getElementById('startStop');
            function startbutton(){
                if (startstop.textContent === 'Start'){
                    startstopserver("start");
                }else if(startstop.textContent === 'Stop'){
                    startstopserver("stop");
                }
                update();
            }
            function update(){
                if(startstop.textContent == "Start"){
                    document.getElementById('status').style.color = "red";
                    document.getElementById('status').innerText = 'NOT RUNNING';
                }else if(startstop.textContent == "Stop"){
                    document.getElementById('status').style.color = "green";
                    document.getElementById('status').innerText = 'RUNNING';
                }else{
                    console.error("Error!");	
                }
            }
            function check(){
                fetch('/check', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        check: "checking",
                    })
                }).then(response => response.json())
                    .then(data => {
                    if(data == true){
                        startstop.innerText = 'Stop';
                    }else if(data == false){
                        startstop.innerText = 'Start';
                    }
                    update();
                });
            }
            (function() {
                check();
                document.getElementById('urls').innerHTML = '<li><a href="'+window.location.protocol+"//"+window.location.hostname+':'+window.location.port+'/" target="_blank" onclick="window.api.openExternal(this.href);event.preventDefault()">'+window.location.protocol+"//"+window.location.hostname+':'+window.location.port+'/</a></li>';
            })();
            function startstopserver(option){
                fetch('/startstop', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        function: option,
                    })
                }).then(response => response.json())
                    .then(data => {
                    if(option == "start"){
                        if(data == true){
                            startstop.innerText = 'Stop'; 
                        }else{
                            console.error("There was error starting the server!");
                        }	
                    }else if(option == "stop"){
                        if(data == true){
                            startstop.innerText = 'Start'; 
                        }else{
                            console.error("There was error stoping the server!");
                        }
                    }else{
                        console.error("Error!");	
                    }
                    update();
                });
                location.reload();
            }
            setInterval(function(){ 
                checkforusers();
            }, 5000);
            function checkforusers(){
                fetch('/numusers', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        "checkn": true
                    })
                }).then(response => response.json())
                    .then(data => {
                    data = data.users;
                    document.getElementById('nuser').innerHTML = "Users connected: "+data;
                });	
            }
            checkforusers();
        </script>
    </body>
</html>
