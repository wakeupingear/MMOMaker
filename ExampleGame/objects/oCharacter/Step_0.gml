/// @description Movement
if (abs(x-target_x)>spd*1.5||abs(y-target_y)>spd*1.5){
	if !visible{
		x=target_x;
		y=target_y;
	}
	else{
		var _dist=(point_direction(x,y,target_x,target_y)+360) mod 360;
		x+=round(lengthdir_x(spd,_dist));
		y+=round(lengthdir_y(spd,_dist));
	}
}