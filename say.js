// import say from "say"

// say.speak(`hello`)

//binary search
let arr = [3,7,9,16,4,1,22,17]

let target = 100;


arr = arr.sort((a,b) => a-b);

console.log(arr);

let left = 0;
let right = arr.length-1;

while(left <= right){
    let mid = Math.floor((right + left)/2);
    if(arr[mid] == target){
        console.log(mid);
        process.exit()
    }

    if(arr[mid] < target){
        left = mid+1;
    }

    if(arr[mid] > target){
        right = mid-1
    }
}

console.log("not found")