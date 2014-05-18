//////////////////////////////////////
// EchoNest functionality

// (1) Spotify's API is open to anyone, for EchoNest's you need to sign up for 
// your own API key -- this is a credential that lets EchoNest keep track of 
// who is using their API how.  You can read more about EchoNest's API, 
// including how to get a key, at http://developer.echonest.com/docs/v4

var ENAPI = 'https://developer.echonest.com/api/v4/';
var ENAPIKey = 'SSNABSZFZFLLHYWUH';


function ENSearch(track) {
    // (1) This function takes a track (which you may remember we got from 
    // Spotify's API) and searches EchoNest for it, returning the first
    // result if there is one

    var artistQuery = artists(track, ' ');
    var titleQuery = track.name;

    var ENResults = ENSongSearch({
        'artist': artistQuery,
        'title': titleQuery
    });

    if (ENResults[0]) {
        return ENResults[0];
    }
    // else
    return null;
}


function ENSongSearch(parameters) {
    // (1) This function searches _just_ EchoNest's song API and returns the 
    // parsed JSON object
    //
    // An example query URL:
    // http://developer.echonest.com/api/v4/song/search?api_key=0TPFPI9TGBX5CJU49&format=json&results=1&artist=radiohead&title=karma%20police

    // Constructing the URL we'll use 
    parameters['format'] = 'json';
    var songSearchAPI = ENAPI + 'song/search';
    var url = [
        songSearchAPI,
        '?api_key=' + ENAPIKey,
        urlEncodeParams(parameters)
    ].join('');

    return JSON.parse(httpGET(url)).response.songs; // grabbing just songs info
}


function ENAudioAnalysis(audioSummariedTrack) {
    // (1) This function takes a track which _already has an audio_summary_ to
    // go get a full audio_analysis from EchoNest.  You can read more about
    // the audio_analysis at:
    // http://developer.echonest.com/docs/v4/_static/AnalyzeDocumentation.pdf

    return JSON.parse(httpGET(audioSummariedTrack.echo.audio_summary.analysis_url));
}


function ENAudioSummary(echoedTrack) {
    // (1) This function runs on a track which _already has the basic EchoNest
    // info_ to grab the audio_summary.  You can read more about the summary:
    // https://developer.echonest.com/raw_tutorials/faqs/faq_04.html

    var audioResult = ENSongMetadata(echoedTrack.echo.id, 'audio_summary');

    if (audioResult.audio_summary) {
        return audioResult.audio_summary;
    }
    // else
    return null;
}


function ENSongMetadata(ENid, bucket) {
    // (1) This function takes an EchoNest ID and a type of metadata to get
    // (EchoNest calls this a 'bucket').
    //
    // Sample query:
    // http://developer.echonest.com/api/v4/track/profile?api_key=FILDTEOIK2HBORODV&format=json&id=TRTLKZV12E5AC92E11&bucket=audio_summary

    // Constructing the URL
    parameters = {
        'id': ENid,
        'bucket': bucket,
        'format': 'json'
    };
    var songMetadataEndpoint = ENAPI + 'song/profile';
    var url = [
        songMetadataEndpoint,
        '?api_key=',
        ENAPIKey,
        urlEncodeParams(parameters)
    ].join('');

    // Grabbing the metadata
    return JSON.parse(httpGET(url)).response.songs[0];
}



////////////////////////////////////////
// Sketching loudness from EchoNest data

function loudnessAt(track, time) {
    // (1) This function finds the EchoNest measurement of how long a given
    // track is at a given time.

    // (3) "segments" are EchoNests objects for small bits of a song which are 
    // acoustically pretty constant.  Read more about them at:
    // http://developer.echonest.com/docs/v4/_static/AnalyzeDocumentation.pdf
    var segments = track.echo.audio_analysis.segments;

    var timeCovered = 0;

    // (2) Search through and find the segment containing the time we seek;
    // each segment is _not_ the same duration 
    for (var i = 0; i < segments.length; i++) {
        timeCovered += segments[i].duration;
        if (timeCovered > time) {
            return segments[i].loudness_max;
        }
    }
    // else
    return -1;
}


function loudnessSketch(track) {
    // (2) This function _returns a function_ which Processing runs to make 
    // our sketch.

    function sketchProc(P) {
        var myTrack = track;

        // (2) We'll plot loudness every 0.25 seconds
        var dt = 0.25;
        var numPoints = Math.round(myTrack.length) / dt;

        var loud = []; // (2) an array to hold loudnesses
        var points = []; // (2) an array to hold the points we'll plot

        P.setup = function() {
            P.size(1000, 80);
            if (track.echo) {
                for (var i = 0; i < numPoints; i++) {
                    loud[i] = loudnessAt(track, dt * i);
                    points[i] = [i, loud[i]];
                }

                // (2) Scale our points down to fill up our width and height
                points = scalePoints(points, P.width, P.height);


                // (1) Draw our points in a slightly transparent black
                P.noFill();
                P.stroke(0, 0.25 * 255);
                P.beginShape();
                for (var j = 0; j < points.length; j++) {
                    var x = points[j][0];
                    var y = P.height + points[j][1];
                    P.curveVertex(x, y);
                }
                P.endShape();
            } else {
                console.log(track.name, "has no EchoNest data.");
            }
        };

        P.draw = function() {
            // (2) Since we're not animating, we don't need anything in draw
        };
    }

    return sketchProc;
}


function plotLoudness(track) {
    // (1) In this function we actually attach the Processing sketch to our canvas

    var P = new Processing(track.canvas, loudnessSketch(track));

    return P;
}

////////////////////////////////////////
// Sketching loudness from EchoNest data

function tempoAt(track, time) {
    // (1) This function finds the EchoNest measurement of how long a given
    // track is at a given time.

    // (3) "segments" are EchoNests objects for small bits of a song which are 
    // acoustically pretty constant.  Read more about them at:
    // http://developer.echonest.com/docs/v4/_static/AnalyzeDocumentation.pdf

    var timeCovered = 0;

    // (2) Search through and find the segment containing the time we seek;
    // each segment is _not_ the same duration 
    for (var i = 0; i < track.echo.audio_analysis.sections.length; i++) {
        timeCovered += track.echo.audio_analysis.sections[i].duration;
        if (timeCovered > time) {
            return track.echo.audio_analysis.sections[i].tempo;
        }
    }
    // else
    return -1;
}

var tempo = []; // (2) an array to hold tempos

function tempoSketch(track) {
    // (2) This function _returns a function_ which Processing runs to make 
    // our sketch.

    function sketchProc(P1) {
        var myTrack = track;

        // (2) We'll plot tempo every 1.125 seconds
        var dt = 12.5;
        var numPoints = Math.round(myTrack.length) / dt;

        
        var points = []; // (2) an array to hold the points we'll plot

        P1.setup = function() {
            P1.size(1000, 400);
            if (track.echo) {
                for (var i = 0; i < numPoints; i++) {
                    tempo[i] = tempoAt(track, dt * i);
                    points[i] = [i, tempo[i]];
                }

                // (2) Scale our points down to fill up our width and height
                points = scalePoints(points, P1.width, P1.height);
                console.log(points);

                // (1) Draw our points in a slightly transparent black
                P1.noFill();
                P1.stroke(0, 0.5 * 255);
                P1.beginShape();
                for (var j = 0; j < points.length; j++) {
                    var x = points[j][0];
                    var y = P1.height + points[j][1];
                    P1.curveVertex(x, y);
                }
                P1.endShape();
            } else {
                console.log(track.name, "has no EchoNest data.");
            }
        };

        P1.draw = function() {
            // (2) Since we're not animating, we don't need anything in draw
        };
    }

    return sketchProc;
}


function plotTempo(track) {
    // (1) In this function we actually attach the Processing sketch to our canvas

    var P1 = new Processing(track.canvas, tempoSketch(track));

    return P1;
}


function rowBackground(row) {
    // (1) This function actually plots the loudness in an orphaned canvas
    // element--_i.e._ a canvas element not in the DOM--and then converts it
    // to https://en.wikipedia.org/wiki/Base64 to construct an image we use
    // as the background of a row, on the fly

    var trackCanvas = document.createElement('canvas');
    var track = trackByHref(row.id);
    track.canvas = trackCanvas;

    plotLoudness(track);


    // You can read more about this technique at:
    // http://www.html5canvastutorials.com/advanced/html5-canvas-get-image-data-url/
    var binaryImageData = trackCanvas.toDataURL("image/png");
    row.style.backgroundImage = "url(" + binaryImageData + ")";

    return binaryImageData;
}
var lyrics = null;
var results = null;
function getLyrics(track) {
    var key = music_match_key;
    var url;
    var artist = track.artists[0].name
    var song = track.name
    var songId;
    //var lyrics;
    var language;
   // artist = "Kanye West";
   // song = "Run This Town";
    url = ENAPI+"song/search?api_key="+ENAPIKey+"&bucket=id:musixmatch-WW&limit=true&bucket=tracks&format=jsonp&artist="+artist+"&title="+song;

    $.ajax({
        url: url,
        jsonp: "callback",
        dataType: "jsonp",
        // work with the response
        success: function( data ) {
            results = data;
            if (data.response.songs[0]) {
                songId = data.response.songs[0].foreign_ids[0].foreign_id.split(':')[2];
                url = "https://api.musixmatch.com/ws/1.1/track.lyrics.get?track_id=" + songId + "&format=jsonp&apikey=" + key;
                $.ajax({
                    url: url,
                    jsonp: "callback",
                    dataType: "jsonp",

                    // work with the response
                    success: function( response ) {
                        if (response.message.body.lyrics) {
                            lyrics = response.message.body.lyrics.lyrics_body.replace('******* This Lyrics is NOT for Commercial use *******', '').replace('...', '');
                            language = response.message.body.lyrics.lyrics_language;
                        }
                        else {
                            return null;
                        }
                    }
                });
            }
            else {
                return null;
            }
        }
    });
    return lyrics;
}