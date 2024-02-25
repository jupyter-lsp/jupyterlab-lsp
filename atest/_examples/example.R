fib=function(n,x=c(0,1)) {
   if (abs(n)>1) for (i in seq(abs(n)-1)) x=c(x[2],sum(x))
   if (n<0) return(x[2]*(-1)^(abs(n)-1)) else if (n) return(x[2]) else return(0)
}

sapply(seq(-31,31), fib)
