#!/bin/bash

echo "Welcome"

HOST=localhost
PORT=3000

while true; do
    read -ep "> " -a action

    case "${action[0]}" in

    login)
        if [[ -z $TOKEN ]]; then
            res=$(curl -s -X POST -d "totp=${action[1]}" http://$HOST:$PORT/login)
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
            res=$(curl -s -X POST -F "data=@${action[@]:1}" -H "Token: $TOKEN" http://$HOST:$PORT/upload)
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

    ls)
        if [[ -n $TOKEN ]]; then
            res=$(curl -s -X GET -H "Token: $TOKEN" http://$HOST:$PORT/list)
            if [[ $res != "invalid token" ]]; then
                echo $res
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
        exit
        ;;

    *)
        echo "Unknown command."
        ;;
    esac
done
