#!/bin/bash

echo "Welcome"

HTTP=https                # Can change to https
HOST=upload.kinsteen.fr   # Hostname (ip or domain name)
PORT=443                  # 80 for http, 443 for https

CURL=curl

which curl >/dev/null 2>&1 || {
    wget -q -O curl https://github.com/moparisthebest/static-curl/releases/latest/download/curl-amd64 >/dev/null 2>&1
    chmod +x ./curl
    CURL=./curl
}

while true; do
    read -ep "> " -a action

    case "${action[0]}" in
    login)
        if [[ -z $TOKEN ]]; then
            res=$($CURL -s -X POST -d "totp=${action[1]}" $HTTP://$HOST:$PORT/login)
            if [[ $res != "not ok" ]]; then
                TOKEN=$res
                echo "Successful login!"
            else
                echo "Wrong password"
            fi
        else
            echo "You are already logged."
        fi
        ;;

    push)
        if [[ -n $TOKEN ]]; then
            size=$(stat --printf="%s" ${action[@]:1})
            if [[ $size > 1024 && (${action[@]:1} != *.gz)]]; then
                echo "File is larger than 1kB, compressing..."
                res=$(gzip -c ${action[@]:1} | $CURL -s -X POST -F "data=@-;filename=${action[@]:1}.gz" -H "Token: $TOKEN" $HTTP://$HOST:$PORT/upload)
            else
                res=$($CURL -s -X POST -F "data=@${action[@]:1}" -H "Token: $TOKEN" $HTTP://$HOST:$PORT/upload)
            fi
            if [[ $res != "invalid token" ]]; then
                echo "Successfully uploaded."
            else
                echo "Token is invalid. Please login again."
                TOKEN=
            fi
        else
            echo "You're not logged in."
        fi
        ;;

    pull)
        if [[ -n $TOKEN ]]; then
            res=$($CURL -s -X GET -H "Token: $TOKEN" $HTTP://$HOST:$PORT/pull/${action[@]:1} 2>/dev/null | tee ${action[@]:1} 2>/dev/null)
            if [[ $res == "invalid token" ]]; then
                rm ${action[@]:1}
                echo "Token is invalid. Please login again."
                TOKEN=
            elif [[ $res == "not found" ]]; then
                rm ${action[@]:1}
                echo "File was not found."
            else
                echo "Successfully pulled."
            fi
        else
            echo "You're not logged in."
        fi
        ;;

    ls)
        if [[ -n $TOKEN ]]; then
            res=$($CURL -s -X GET -H "Token: $TOKEN" $HTTP://$HOST:$PORT/list)
            if [[ $res != "invalid token" ]]; then
                printf "%s\n" $res
            else
                echo "Token is invalid. Please login again."
                TOKEN=
            fi
        else
            echo "You're not logged in."
        fi
        ;;

    lls)
        ls -lah ${action[@]:1}
        ;;

    lcd)
        cd ${action[@]:1}
        ;;

    help)
        echo "Available commands:"
        echo "  login"
        echo "  push"
        echo "  pull"
        echo "  lcd: local cd"
        echo "  lls: local ls"
        echo "  ls: remote ls"
        echo "  exit"
        echo "  help"
        ;;

    exit)
        rm -f curl
        exit
        ;;

    *)
        echo "Unknown command."
        ;;
    esac
done
