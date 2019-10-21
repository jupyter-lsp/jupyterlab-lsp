fib()
{
  if [ $1 -le 0 ]
  then
    echo 0
    return 0
  fi
  if [ $1 -le 2 ]
  then
    echo 1
  else
    a=$(fib $[$1-1])
    b=$(fib $[$1-2])
    echo $(($a+$b))
  fi
}


fib 5