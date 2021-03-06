const express = require('express');
const router  = express.Router();
const {ensureAuthenticated} = require('../config/auth');
const axios = require('axios');

var amqp = require('amqplib/callback_api');
var send_channel;

var resend_querry = 100;


function connect_to_rabbit() {
    amqp.connect('amqp://matchmaking-queue', function(error0, connection){
        if (error0) {
            console.log("unsuccessful rabbit connection");
            setTimeout(connect_to_rabbit, 5000);
        }
        else {
            console.log("rabbit connected");
            connection.createChannel(function(error1, channel) {
                if (error1) {
                    throw error1;
                }
                var queue = 'matchmakingQueue';
            
                channel.assertQueue(queue, {
                    durable: false
                });
                send_channel = channel;
            });
        }
    });
}

connect_to_rabbit();

function check_if_active_game(req, res, fun) {
    axios
        .post('http://game-server:9002/check_active_game/', {
            player: req.session.passport.user
        })
        .then(function (response) {
            if (response.data.status == 0)
                res.redirect('play')
            else
                fun(req, res)
        })
        .catch(function (error) {
            console.log("error check if active game");
            res.send("check if active game");
        }); 
}

router.get('/register', (req,res)=>{
    res.render('register');
})

router.get('/',ensureAuthenticated,(req,res)=>{
    check_if_active_game(req, res, function (req, res) {
        axios
            .post('http://match-history:9003/get_recent_history/', {
                player: req.session.passport.user
            })
            .then(function (response) {
                var user_history = response.data.player;
                var all_history = response.data.all;
                res.render('index',{
                    user: req.session.passport.user,
                    user_history: user_history,
                    all_history: all_history
                });
            })
            .catch(function (error) {
                console.log("error check if active game");
                res.send("check if active game");
            }); 
        
    })
})

router.get('/profile/:user',ensureAuthenticated,(req,res)=>{
    check_if_active_game(req, res, function (req, res) {
        axios
            .post('http://match-history:9003/get_match_history/', {
                player: req.params.user
            })
            .then(function (response) {

                var history = response.data;
                axios
                    .post('http://users:9000/get_stats', {
                        player: req.params.user
                    })
                    .then(function (response) {
                        res.render('profile',{
                            user: req.params.user,
                            history: history,
                            stats: response.data
                        });
                    })
                    .catch(function (error) {
                        console.log("error check if active game");
                        res.send("check if active game");
                    }); 
            })
            .catch(function (error) {
                console.log("error check if active game");
                res.send("check if active game");
            }); 
    })
})

router.get('/play',ensureAuthenticated,(req,res)=> {
    res.render('play');
})

router.get('/search/:querry',ensureAuthenticated,(req,res)=> {
    axios
        .post('http://users:9000/search_users/', {
            querry: req.params.querry
        })
        .then(function (response) {
            res.render('search_res', {querry: req.params.querry, users: response.data});
        })
        .catch(function (error) {
            console.log("error search");
            res.send("error search");
        }); 
})


function await_game(req, res) {
    axios
        .post('http://matchmaking-server:9001/get_match/', {
            user: req.session.passport.user
        })
        .then(function (response) {
            if (response.data.status == 0) {
                res.send({status: 0});
            }
            else if (response.data.status == 1) {
                res.send({status: 1});
            }
            else
                setTimeout(await_game, resend_querry, req, res);
        })
        .catch(function (error) {
            console.log("error await game");
            res.send("error await game");
        }); 
}

function await_custom_code(req, res) {
    axios
        .post('http://matchmaking-server:9001/get_custom_code/', {
            user: req.session.passport.user
        })
        .then(function (response) {
            if (response.data.status == 0) {
                res.send({status: 0, code: response.data.code});
            }
            else
                setTimeout(await_custom_code, resend_querry, req, res);
        })
        .catch(function (error) {
            console.log("error await game");
            res.send("error await game");
        });
}

router.get('/find_game',ensureAuthenticated,(req,res)=>{
    send_channel.sendToQueue("matchmakingQueue", Buffer.from(JSON.stringify({type:"normal", user: req.session.passport.user})));
    setTimeout(await_game, 100, req, res);
});

router.get('/create_custom_game',ensureAuthenticated,(req,res)=>{
    send_channel.sendToQueue("matchmakingQueue", Buffer.from(JSON.stringify({type:"custom", user: req.session.passport.user})));
    setTimeout(await_custom_code, 100, req, res);
});

router.get('/await_custom_game',ensureAuthenticated,(req,res)=>{
    setTimeout(await_game, 100, req, res);
});

router.post('/join_custom_game',ensureAuthenticated,(req,res)=>{
    console.log("join custom game" + req.body.code);
    send_channel.sendToQueue("matchmakingQueue", Buffer.from(JSON.stringify({type:"custom_join", user: req.session.passport.user, code: req.body.code})));
    setTimeout(await_game, 100, req, res);
});

function get_initial_board_state(req, res) {
    axios
        .post('http://game-server:9002/get_board_state/', {
            player: req.session.passport.user
        })
        .then(function (response) {
            res.send(response.data);
        })
        .catch(function (error) {
            console.log("error initial board state");
            res.send("error initial board state");
        }); 
}

router.get('/get_initial_board_state',ensureAuthenticated,(req,res)=>{
    setTimeout(get_initial_board_state, 100, req, res);
})

router.get('/surrender',ensureAuthenticated,(req,res)=>{
    axios
        .post('http://game-server:9002/surrender/', {
            player: req.session.passport.user
        })
        .then(function (response) {
            res.send(response.data);
        })
        .catch(function (error) {
            console.log("error surrender");
            res.send("error surrender");
        }); 
})

function get_board_state(req, res) {
    axios
        .post('http://game-server:9002/get_board_state/', {
            player: req.session.passport.user
        })
        .then(function (response) {
            if (response.data.status != 0) {
                res.send(response.data);
                return;
            }

            if (response.data.game_state == 'undecided' && response.data.color != response.data.move) {
                setTimeout(get_board_state, resend_querry, req, res);
            }
            else {
                res.send(response.data);
            }
        })
        .catch(function (error) {
            console.log("error board state");
            res.send("error board state");
        }); 
}

router.get('/get_board_state',ensureAuthenticated,(req,res)=>{
    get_board_state(req, res);
})

router.post('/update_board_state',ensureAuthenticated,(req,res)=>{
    axios
        .post('http://game-server:9002/update_board_state/', {
            player: req.session.passport.user,
            source: req.body.source,
            target: req.body.target
        })
        .then(function (response) {
            res.send(response.data);
        })
        .catch(function (error) {
            console.log("error update");
            res.send("error update");
        }); 
})

module.exports = router; 