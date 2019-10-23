const state = {
    lastRole: undefined,
    roleRetrievalCount: 0,
};

const setMessage = (message) => {
    document.getElementById("message").innerText = message;
};

const selectRole = async (e) => {
    setMessage(`Retrieving ${e.target.dataset.role} role, please hold.`);
    state.lastRole = e.target.dataset.role;

    // hide the roles from the page
    $("#role-picker").addClass("hidden");

    r = await fetch("/api/roles", {
        method: "POST",
        body: JSON.stringify({
            arn: e.target.dataset.arn,
        }),
        headers: {
            "Content-Type": "application/json",
        }
    });

    state.roleRetrievalCount += 1;
};

const showRoles = async (roles, message) => {
    if (roles.length === 0) {
        await shutdown();
        setMessage("Sorry, no roles available. You may now close this window.");
        return;
    }

    const source = $("#role-picker-template").html();
    const template = Handlebars.compile(source);

    // display the role options on the page
    $("#role-picker").html(template(roles)).removeClass("hidden");

    // set the event handlers on the newly created nodes
    $("a[data-arn]").on("click", selectRole);
};

const shutdown = async () => {
    clearInterval(pollState);

    // shutdown the listener
    await fetch("/shutdown", {
        method: "GET",
        cache: "no-cache",
    });
};

const pollState = setInterval(async () => {
    let response = await fetch("/api/state", {
        method: "GET"
    });

    const remoteState = await response.json();

    console.log("state is", remoteState);

    if (remoteState.state === "redirecting") {
        const url = new URL(document.location);

        // make a fetch request
        r = await fetch("/redirect_callback", {
            method: "POST",
            body: JSON.stringify({
                code: url.searchParams.get("code"),
                state: url.searchParams.get("state"),
                error: url.searchParams.get("error"),
                error_description: url.searchParams.get("error_description"),
            }),
            headers: {
                "Content-Type": "application/json",
            }
        });
    } else if (remoteState.state === "role_picker") {
        if (state.roleRetrievalCount > 0) {
            setMessage(`Invalid role ${state.lastRole}. Please pick a different role:`)
        } else {
            setMessage("Please select a role:");
        }

        response = await fetch("/api/roles", {
            method: "GET",
            cache: "no-cache"
        });

        // show the roles
        const roles = await response.json();
        showRoles(roles["roles"]);
    } else if (remoteState.state === "aws_federate") {
        setMessage("Redirecting to AWS...");
        await shutdown();

        document.location = remoteState.value.awsFederationUrl;
    } else if (remoteState.state === "error") {
        setMessage(remoteState.value.message);
        await shutdown();
    } else if (remoteState.state === "finished") {
        // shutdown the web server, the poller, and close the window
        clearInterval(pollState);
        await shutdown();
        setMessage("You may now close this window.");
    }
}, 250);

// sleep for any number of milliseconds
const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
};
