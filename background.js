window.onload = function () {
    document.querySelector('button').addEventListener('click', function () {
        chrome.identity.getAuthToken({ interactive: true }, function (token) {
            const youtubeInit = {
                method: 'GET',
                async: true,
                headers: {
                    "Authorization": 'Bearer ' + token,
                    "Content-Type": 'application/json'
                }
            };
            
            function setDates(datesObj, data) {
                const items = data.items;
                for (let i = 0; i < items.length; i++) {
                    let videoId = items[i]['snippet']['resourceId']['videoId'];
                    let dateAdded = items[i]['snippet']['publishedAt'];
                    datesObj[videoId] = dateAdded.substring(0, dateAdded.indexOf("T"));
                }
            }

            async function getPlaylistItems(nextPageToken, playlistId) {
                return fetch(
                    // I used an AWS Lambda function to store keys, but you can use something else.
                    // I don't recommend pasting in the code at all, but if you're only working locally, it won't really make a difference.
                    input = '',
                    init = { method: 'GET', async: true }
                )
                    .then(response => response.json())
                    .then(async (data) => {
                        let apiKey = data.message;
                        if (nextPageToken) {
                            console.log(youtubeInit);
                            return fetch(
                                input = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&pageToken=${nextPageToken}&maxResults=50&mine=true&key=${apiKey}`,
                                init = youtubeInit
                            )
                                .then((response) => response.json())
                        }
                        else {
                            console.log(youtubeInit);
                            return fetch(
                                input = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&mine=true&key=${apiKey}`,
                                init = youtubeInit
                            )
                                .then((response) => response.json())
                        }
                    })
            }


            async function updateDatesObj(datesObj) {
                let nextPageToken = "";
                let tabQueryOptions = { active: true, lastFocusedWindow: true };
                let [tab] = await chrome.tabs.query(tabQueryOptions);
                console.log(tab.url);
                let playlistIdIdx = tab.url.indexOf("list=") + 5;
                let playlistId = tab.url.substring(playlistIdIdx);
                do {
                    await getPlaylistItems(nextPageToken, playlistId)
                        .then((data) => {
                            nextPageToken = data.nextPageToken;
                            setDates(datesObj, data);
                        })
                }
                while (nextPageToken);
                return tab.id;
            }

            async function createDatesObj() {
                let datesObj = {};
                let tabId = await updateDatesObj(datesObj);
                return [datesObj, tabId];
            }

            function contentScript(contentDatesObj) {
                console.log("*************FROM EXTENSION CONTENT SCRIPT*******************");
                console.log(contentDatesObj);
                controlScript(contentDatesObj);

                function controlScript(contentDatesObj) {
                    var playlistItemElements = document.getElementsByTagName("ytd-playlist-video-renderer");
                    /* For each <ytd-playlist-video-renderer> element: 
                    *   Grab the videoId from the <thumbnail> element
                    *   Grab the <yt-formatted-string> from <ytd-video-meta-block> element
                    *   Send videoId and string element to appendAddedDate
                    */
                    for (let rendererElement of playlistItemElements) {
                        let [thumbnailElement] = rendererElement.getElementsByTagName("ytd-thumbnail"); //get thumbnail element because it has <a> element with video link
                        let [anchor] = thumbnailElement.getElementsByTagName("a"); //get <a> element
                        let vidUrl = anchor.getAttribute("href"); // get href attribute
                        let videoId = vidUrl.substring(vidUrl.indexOf("v=") + 2, vidUrl.indexOf("list=") - 1); //grab video id from url
                        let [metaBlockElement] = rendererElement.getElementsByTagName("ytd-video-meta-block"); //grab <ytd-video-meta-block>
                        let stringElements = metaBlockElement.getElementsByTagName("yt-formatted-string");
                        let stringElement = stringElements[1];
                        if (!stringElement.querySelector("#extensionCustomSpan")) {
                            appendDateAdded(stringElement, contentDatesObj[videoId]);
                        }
                    }
                }

                function appendDateAdded(stringElement, date) {
                    let sepSpan = document.createElement("span"); //create a <span> element for the separator between metadata strings
                    let dateAddedSpan = document.createElement("span") //create a <span> element for dateAdded
                    sepSpan.dir = "auto";
                    sepSpan.className = "style-scope yt-formatted-string";
                    sepSpan.innerText = " • ";
                    dateAddedSpan.id = "extensionCustomSpan"; //set custom id so we don't append to one element more than once
                    dateAddedSpan.dir = "auto";
                    dateAddedSpan.className = "style-scope yt-formatted-string";
                    dateAddedSpan.innerText = "Added " + date;
                    stringElement.appendChild(sepSpan);
                    stringElement.appendChild(dateAddedSpan);
                }
            }

            async function injectContentScript() {
                let [datesObj, tabId] = await createDatesObj();
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: contentScript,
                    args: [datesObj]
                });
            }
            injectContentScript();
        });
    });
};
