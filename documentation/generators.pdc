Generators
==========

- every generator must be an object
- must contain field 'arb', which is a function which will generate a value
  for a given 'seed'
- generators may have field 'shrink' to support shrinking.
- if 'shrink' is not defined it is assumed to be 'null'. In either case 
  the generator will not support shrinking
- shrinking function must return new Array of possible shrinked values.
- input to shrinking function is the 'seed' and the generated value to be
  shrinked

