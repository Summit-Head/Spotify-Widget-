// ! CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN are environment variables defined in Cloudflare

// TODO: Error checking on some fetch responses.
// TODO: Remove states completely?, since this is designed for use by only one user.

var recent = false;
//I really dont wanna learn GET or POST rn so im doing this i guess. i think im going to skip that 8 AM class. 

addEventListener("fetch", (event) => {
  var url = new URL(event.request.url);
  // Simple routing
  var route = url.pathname.replaceAll("/", "");
  switch (route) {
    case "hello":
      event.respondWith(handleHello(event.request));

      break;
    case "authorize":
      event.respondWith(handleAuthorization(event.request));

      break;
    case "callback":
      event.respondWith(handleCallback(event.request));

      break;
    //im sure this could be better. however, i dont care
    case "get-now-playing":
      event.respondWith(handleNowPlaying(event.request));

      break;
    case "get-all":
      recent = true;
      event.respondWith(handleNowPlaying(event.request));

      break;
    default:
      event.respondWith(new Response("ERROR: Unsupported request."));
  }
});

async function handleHello(request) {
  return new Response("Hello!, This is my first middleware thingy.");
}

async function handleAuthorization(request) {
  var state = "SPOTIFY_WIDGET"; // TODO: No use? remove?
  var url = new URL(request.url);
  var callback_url = `${url.protocol}//${url.hostname}/callback`;
  var scope = "user-read-currently-playing user-read-recently-played";
  var params = {
    response_type: "code",
    client_id: CLIENT_ID,
    scope: scope,
    redirect_uri: callback_url,
    state: state,
  };

  // https://howchoo.com/javascript/how-to-turn-an-object-into-query-string-parameters-in-javascript
  var queryString = Object.keys(params)
    .map((key) => key + "=" + params[key])
    .join("&");

  return Response.redirect(
    "https://accounts.spotify.com/authorize?" + queryString,
    302
  );
}

async function handleCallback(request) {
  var url = new URL(request.url);
  var callback_url = `${url.protocol}//${url.hostname}/callback`;
  var code = url.searchParams.get("code") || null;
  var state = url.searchParams.get("state") || null; // TODO: Might remove later?

  if (state === "SPOTIFY_WIDGET") {
    return fetch("https://accounts.spotify.com/api/token", {
      method: "post",
      headers: {
        Authorization: "Basic " + btoa(CLIENT_ID + ":" + CLIENT_SECRET),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `code=${code}&redirect_uri=${callback_url}&grant_type=authorization_code`,
    })
      .then((response) => {
        if (response.status === 200) {
          return response.json();
        } else
          return new Response("Something went wrong, retry authorization :/");
      })
      .then((data) => {
        return new Response(`Your refresh token is: ${data.refresh_token}`);
      });
  } else return new Response("Something went wrong, retry authorization :/");
}

async function handleNowPlaying(request) {
  // Get a new access token everytime :D << Easy way out (Without checking expire time)
  // if he isn't worried about the quota, i guess i shouldn't be. but im in too deep now. lets see what happens. - Summit
  var access_token = await fetch("https://accounts.spotify.com/api/token", {
    method: "post",
    headers: {
      Authorization: "Basic " + btoa(CLIENT_ID + ":" + CLIENT_SECRET),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=refresh_token&refresh_token=${REFRESH_TOKEN}`,
  })
    .then((response) => {
      // TODO: Check errors here
      return response.json();
    })
    .then((data) => {
      return data.access_token;
    });
  var songData = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    {
      headers: {
        Authorization: "Bearer " + access_token,
      },
    }
  ).then((response) => {
    // TODO: Check errors here
    return response.text();
  });
  //if we also wanted the recently played (trying to minimize the requests in case of more traffic, seems like a good practice? Thats half of what im doing here, practice by doing projects and stuff) - summit
  var playedData = null;
  // ^ whatever, good enough
  if (recent){
    playedData = await fetch(
      "https://api.spotify.com/v1/me/player/recently-played?limit=6",
      //maximum of 6 when ill usually use 4 because I want multiple versions for different pages and experimenting. im doing so much crap for a website i haven't even made yet and i have to get up at 7 tomorrow oh well. - Summit
      {
        headers: {
          Authorization: "Bearer " + access_token,
        },
      }
    ).then((response) => {
        // TODO: Check errors here
      return response.text();
    });
  }
  // https://mcculloughwebservices.com/2016/09/23/handling-a-null-response-from-an-api/
  // If response is empty throw error
  if (!songData) songData = { ERROR: "Couldn't retrieve now playing." };
  else songData = JSON.parse(songData);
  // if (!playedData) playedData = { ERROR: "Couldn't retrieve played." };
  // else 

  // ^i think theres always recently played? im about to find out! -summit

  ////ok i think im done??? i should have tested things along the way, but it might be fine in this case... - summit
  //edit: IT WAS NOT FINE
  playedData = JSON.parse(playedData);

  // Add CORS to allow requests from any domain
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Max-Age": "86400",
  };
  return new Response(JSON.stringify([songData, playedData], null, 3), {
    headers: corsHeaders,
  });
}
